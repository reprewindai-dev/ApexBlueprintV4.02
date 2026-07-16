export type ProviderName = "openai" | "anthropic" | "deepseek" | "llama" | "custom" | "veklom";

export interface OpenAICompatibleRequestOptions {
  provider: ProviderName;
  apiKey?: string;
  modelName?: string;
  customUrl?: string;
  authMode?: "bearer" | "apiKeyHeader" | "customHeader" | "none";
  customHeaderName?: string;
  mode?: "chat" | "verify";
}

export interface OpenAICompatibleRequest {
  chatUrl: string;
  verifyUrl: string;
  headers: Record<string, string>;
  payload: Record<string, unknown>;
}

export function buildOpenAICompatibleRequest(options: OpenAICompatibleRequestOptions): OpenAICompatibleRequest {
  const { provider, apiKey, modelName, customUrl, authMode = "bearer", customHeaderName, mode = "chat" } = options;

  let baseUrl = "https://api.openai.com/v1";

  if (provider === "veklom") {
    baseUrl = "https://api.veklom.com/v1";
  } else if (customUrl) {
    baseUrl = customUrl;
  } else if (provider === "llama") {
    baseUrl = "http://localhost:11434/v1";
  } else if (provider === "deepseek") {
    baseUrl = "https://api.deepseek.com/v1";
  } else if (provider === "openai") {
    baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "http://localhost:1106/modelfarm/openai";
  }

  const chatUrl = baseUrl.replace(/\/+$/, "") + "/chat/completions";
  const verifyUrl = baseUrl.replace(/\/+$/, "") + "/models";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    if (authMode === "bearer") {
      headers.Authorization = `Bearer ${apiKey}`;
    } else if (authMode === "apiKeyHeader") {
      headers["x-api-key"] = apiKey;
    } else if (authMode === "customHeader" && customHeaderName) {
      headers[customHeaderName] = apiKey;
    }
  }

  const payload = {
    model: modelName || (provider === "deepseek" ? "deepseek-chat" : provider === "openai" ? "gpt-4o" : provider === "veklom" ? "qwen2.5-coder:1.5b" : "llama-3-8b-instruct"),
    messages: [{ role: "user", content: mode === "verify" ? "Respond with OK." : "Respond with OK." }],
    max_tokens: mode === "verify" ? 10 : 512,
    temperature: 0.1,
  };

  return { chatUrl, verifyUrl, headers, payload };
}
