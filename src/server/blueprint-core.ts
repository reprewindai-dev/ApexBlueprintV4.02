// Model provider routing: sends a system and user prompt to the chosen provider and
// returns the reply text. Shared by the server, the Cloudflare Pages Functions and the
// browser, so it must not import Node-only modules.
import { GoogleGenAI } from "@google/genai";

export type LlmEnv = Record<string, string | undefined>;

export interface BlueprintModelOptions {
  selectedProvider: string;
  apiKey?: string;
  modelName?: string;
  customUrl?: string;
  authMode?: string;
  customHeaderName?: string;
  systemPrompt: string;
  userPrompt: string;
  // "json" (default) asks providers that support it for a JSON-only reply; "text" for free text such as code.
  responseFormat?: "json" | "text";
}

// Reads an OpenAI-compatible chat completion, streamed (server-sent events) or not:
// some compatible servers ignore "stream" and answer with one JSON body.
async function readChatCompletion(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream") || !response.body) {
    const data = await response.json();
    return data?.choices?.[0]?.message?.content ?? "";
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  const consume = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") return;
    try {
      const chunk = JSON.parse(data);
      if (chunk?.error) throw new Error(chunk.error.message || String(chunk.error));
      text += chunk?.choices?.[0]?.delta?.content ?? "";
    } catch (err) {
      if (err instanceof SyntaxError) return;
      throw err;
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(consume);
  }
  consume(buffer);
  return text;
}

// Reads a streamed Anthropic Messages response (server-sent events).
async function readAnthropicStream(response: Response): Promise<{ text: string; stopReason: string }> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream") || !response.body) {
    const data = await response.json();
    const text = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    return { text, stopReason: data.stop_reason || "" };
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let stopReason = "";
  const consume = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    let event: any;
    try {
      event = JSON.parse(trimmed.slice(5).trim());
    } catch {
      return;
    }
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") text += event.delta.text;
    else if (event.type === "message_delta" && event.delta?.stop_reason) stopReason = event.delta.stop_reason;
    else if (event.type === "error") throw new Error(`Anthropic API failed: ${event.error?.message || "stream error"}`);
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(consume);
  }
  consume(buffer);
  return { text, stopReason };
}

export async function callBlueprintModel(opts: BlueprintModelOptions, env: LlmEnv): Promise<string> {
  const { selectedProvider, apiKey, modelName, customUrl, authMode, customHeaderName, systemPrompt, userPrompt } = opts;
  const wantJson = opts.responseFormat !== "text";
    // Use the already declared selectedProvider
    let textResult = "";

    if (selectedProvider === "gemini") {
      const activeApiKey = apiKey || env.GEMINI_API_KEY;
      if (!activeApiKey) {
        throw new Error("Gemini API key is not configured. Please supply a key or configure it in secrets.");
      }

      // Check if custom URL or environment base URL is provided
      const geminiBaseUrl = customUrl || env.AI_INTEGRATIONS_GEMINI_BASE_URL;
      const aiOptions: any = {
        apiKey: activeApiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      };
      if (geminiBaseUrl) {
        aiOptions.baseUrl = geminiBaseUrl;
      }

      const ai = new GoogleGenAI(aiOptions);

      const response = await ai.models.generateContent({
        model: modelName || "gemini-3.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          ...(wantJson ? { responseMimeType: "application/json" } : {}),
          temperature: 0.2,
        },
      });

      textResult = response.text || "";
    } else if (selectedProvider === "openai" || selectedProvider === "llama" || selectedProvider === "ollama" || selectedProvider === "deepseek" || selectedProvider === "custom") {
      // Determine base URL to use
      let openAiBaseUrl = "https://api.openai.com/v1";
      if (customUrl) {
        openAiBaseUrl = customUrl;
      } else if (selectedProvider === "llama" || selectedProvider === "ollama") {
        openAiBaseUrl = env.AI_INTEGRATIONS_OLLAMA_BASE_URL || env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
      } else if (selectedProvider === "deepseek") {
        openAiBaseUrl = "https://api.deepseek.com/v1";
      } else if (selectedProvider === "openai") {
        openAiBaseUrl = env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
      }

      // Clean the endpoint: strip trailing slashes, make sure it has /chat/completions
      let cleanUrl = openAiBaseUrl.replace(/\/+$/, "");
      if (!cleanUrl.endsWith("/chat/completions")) {
        cleanUrl = `${cleanUrl}/chat/completions`;
      }

      // Configure headers
      const headers: any = {
        "Content-Type": "application/json",
      };
      
      // Dynamic auth mode application
      if (apiKey) {
        if (authMode === "bearer") {
          headers.Authorization = `Bearer ${apiKey}`;
        } else if (authMode === "apiKeyHeader") {
          headers["x-api-key"] = apiKey;
        } else if (authMode === "customHeader" && customHeaderName) {
          headers[customHeaderName] = apiKey;
        } else if (authMode === "none") {
          // No authentication headers
        } else {
          // Default fallback
          headers.Authorization = `Bearer ${apiKey}`;
        }
      } else if (selectedProvider === "openai" && !env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
        // Only require API key if using real OpenAI without a local modelfarm/proxy override
        throw new Error("OpenAI API key is required for this model provider.");
      }

      // Build payload
      const payload: any = {
        model: modelName || (selectedProvider === "deepseek" ? "deepseek-chat" : selectedProvider === "openai" ? "gpt-4o" : "llama3.2"),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      };

      // Only pass JSON response format if using a provider known to support it natively
      if (wantJson && (selectedProvider === "openai" || selectedProvider === "deepseek" || selectedProvider === "llama" || selectedProvider === "ollama")) {
        payload.response_format = { type: "json_object" };
      }

      
      // Stream the reply: headers arrive at once, so a slow model (e.g. Ollama on a laptop
      // CPU) is not cut off by the runtime's response-header timeout.
      payload.stream = true;
      const response = await fetch(cleanUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${selectedProvider.toUpperCase()} API failed: ${errorText}`);
      }
      textResult = await readChatCompletion(response);
    } else if (selectedProvider === "anthropic") {
      const activeApiKey = apiKey;
      if (!activeApiKey) {
        throw new Error("Anthropic API key is required.");
      }

      const anthropicUrl = customUrl || "https://api.anthropic.com/v1/messages";

      const headers = {
        "Content-Type": "application/json",
        "x-api-key": activeApiKey,
        "anthropic-version": "2023-06-01",
      };

      const payload = {
        model: modelName || "claude-opus-5-5",
        max_tokens: 16000,
        system: systemPrompt,
        messages: [
          { role: "user", content: userPrompt }
        ],
        stream: true,
      };

      const response = await fetch(anthropicUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API failed: ${errorText}`);
      }

      const { text, stopReason } = await readAnthropicStream(response);
      if (stopReason === "refusal") {
        throw new Error("Anthropic declined this request (stop_reason: refusal).");
      }
      textResult = text;
    } else {
      // No provider chosen: use a Gemini key configured on the server, if any.
      const activeApiKey = env.GEMINI_API_KEY;
      if (!activeApiKey) {
        throw new Error("Choose a model provider first.");
      }

      const geminiBaseUrl = env.AI_INTEGRATIONS_GEMINI_BASE_URL;
      const aiOptions: any = {
        apiKey: activeApiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      };
      if (geminiBaseUrl) {
        aiOptions.baseUrl = geminiBaseUrl;
      }

      const ai = new GoogleGenAI(aiOptions);
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          ...(wantJson ? { responseMimeType: "application/json" } : {}),
          temperature: 0.2,
        },
      });
      textResult = response.text || "";
    }

  return textResult;
}
