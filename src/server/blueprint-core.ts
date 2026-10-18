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
  // A JSON Schema the reply must match, for providers that can enforce one (Claude, Ollama).
  jsonSchema?: Record<string, unknown>;
  // Called with the token counts the provider reports, if it reports them.
  onUsage?: (usage: { inputTokens: number; outputTokens: number }) => void;
}

// Ollama gives a model a small context window unless asked for more; a full plan
// (prompt plus several thousand tokens of reply) does not fit in it and comes back cut off.
export const OLLAMA_CONTEXT_TOKENS = 16384;

// Claude models that take output_config (effort and a JSON Schema reply format).
const CLAUDE_STRUCTURED = /^claude-(fable-|mythos-|opus-5|opus-4-8|sonnet-5|haiku-5)/;
// Claude models that take the server-side refusal fallback ("default" form).
const CLAUDE_FALLBACK = /^claude-(fable-5-1|opus-5|sonnet-5-5)/;

// Ollama's own chat API (not its OpenAI-compatible one), which accepts a context size
// and a JSON Schema for the reply. Takes the address with or without /v1.
async function callOllama(opts: BlueprintModelOptions, baseUrl: string, wantJson: boolean): Promise<string> {
  const root = baseUrl.replace(/\/+$/, "").replace(/\/chat\/completions$/, "").replace(/\/v1$/, "");
  const response = await fetch(`${root}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.modelName || "qwen2.5:14b",
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: opts.userPrompt },
      ],
      stream: true,
      ...(wantJson ? { format: opts.jsonSchema || "json" } : {}),
      options: { num_ctx: OLLAMA_CONTEXT_TOKENS, temperature: 0.2 },
    }),
  });
  if (!response.ok) throw new Error(`OLLAMA API failed: ${await response.text()}`);
  if (!response.body) throw new Error("OLLAMA API failed: empty response");

  // The reply streams as one JSON object per line.
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let doneReason = "";
  const consume = (line: string) => {
    if (!line.trim()) return;
    let chunk: any;
    try {
      chunk = JSON.parse(line);
    } catch {
      return;
    }
    if (chunk.error) throw new Error(`OLLAMA API failed: ${chunk.error}`);
    text += chunk.message?.content ?? "";
    if (chunk.done) {
      doneReason = chunk.done_reason || "";
      if (typeof chunk.prompt_eval_count === "number" && typeof chunk.eval_count === "number") {
        opts.onUsage?.({ inputTokens: chunk.prompt_eval_count, outputTokens: chunk.eval_count });
      }
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
  if (doneReason === "length") {
    throw new Error("The plan was cut off before it finished: the model ran out of room. Try a model with a larger context, or shorter notes.");
  }
  return text;
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
interface AnthropicResult {
  text: string;
  stopReason: string;
  inputTokens?: number;
  outputTokens?: number;
}

async function readAnthropicStream(response: Response): Promise<AnthropicResult> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream") || !response.body) {
    const data = await response.json();
    const text = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    return { text, stopReason: data.stop_reason || "", inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens };
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let stopReason = "";
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
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
    else if (event.type === "message_start") inputTokens = event.message?.usage?.input_tokens;
    else if (event.type === "message_delta") {
      if (event.delta?.stop_reason) stopReason = event.delta.stop_reason;
      if (typeof event.usage?.output_tokens === "number") outputTokens = event.usage.output_tokens;
    } else if (event.type === "error") throw new Error(`Anthropic API failed: ${event.error?.message || "stream error"}`);
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
  return { text, stopReason, inputTokens, outputTokens };
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
    } else if (selectedProvider === "ollama" || selectedProvider === "llama") {
      const baseUrl = customUrl || env.AI_INTEGRATIONS_OLLAMA_BASE_URL || env.OLLAMA_BASE_URL || "http://localhost:11434";
      textResult = await callOllama(opts, baseUrl, wantJson);
    } else if (selectedProvider === "openai" || selectedProvider === "deepseek" || selectedProvider === "custom") {
      // Determine base URL to use
      let openAiBaseUrl = "https://api.openai.com/v1";
      if (customUrl) {
        openAiBaseUrl = customUrl;
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
        model: modelName || (selectedProvider === "deepseek" ? "deepseek-chat" : "gpt-4o"),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      };

      // Only pass JSON response format if using a provider known to support it natively
      if (wantJson && (selectedProvider === "openai" || selectedProvider === "deepseek")) {
        payload.response_format = { type: "json_object" };
      }

      
      // Stream the reply: headers arrive at once, so a slow model is not cut off by the
      // runtime's response-header timeout.
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

      const model = modelName || "claude-opus-5-5";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-api-key": activeApiKey,
        "anthropic-version": "2023-06-01",
      };

      const payload: Record<string, unknown> = {
        model,
        // Thinking counts toward this limit, and a full plan is long: leave room so it is
        // not cut off. Streaming keeps a large limit safe from HTTP timeouts.
        max_tokens: 64000,
        system: systemPrompt,
        messages: [
          { role: "user", content: userPrompt }
        ],
        stream: true,
      };
      if (CLAUDE_STRUCTURED.test(model)) {
        payload.output_config = {
          effort: "high",
          ...(wantJson && opts.jsonSchema ? { format: { type: "json_schema", schema: opts.jsonSchema } } : {}),
        };
      }
      // If the model's safety checks decline a request, Anthropic retries it on its
      // recommended fallback model instead of failing.
      if (!customUrl && CLAUDE_FALLBACK.test(model)) {
        headers["anthropic-beta"] = "server-side-fallback-2026-07-01";
        payload.fallbacks = "default";
      }

      const response = await fetch(anthropicUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API failed: ${errorText}`);
      }

      const { text, stopReason, inputTokens, outputTokens } = await readAnthropicStream(response);
      if (typeof inputTokens === "number" && typeof outputTokens === "number") opts.onUsage?.({ inputTokens, outputTokens });
      if (stopReason === "refusal") {
        throw new Error("Anthropic declined this request (stop_reason: refusal).");
      }
      if (stopReason === "max_tokens") {
        throw new Error("The plan was cut off before it finished: the model reached its output limit. Try again, or shorten the notes.");
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
