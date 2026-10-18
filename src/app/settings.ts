// Model settings: which AI writes the plan. Stored on this device only.
export type ProviderId = "anthropic" | "openai" | "gemini" | "deepseek" | "ollama" | "custom";

export interface ModelSettings {
  provider: ProviderId;
  model: string;
  apiKey: string;
  baseUrl: string;
  rememberKey: boolean;
}

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  defaultModel: string;
  needsKey: boolean;
  keyHint?: string;
  keyUrl?: string;
  defaultBaseUrl?: string;
  note?: string;
}

export const PROVIDERS: ProviderInfo[] = [
  { id: "anthropic", name: "Claude (Anthropic)", defaultModel: "claude-opus-5-5", needsKey: true, keyHint: "sk-ant-…", keyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "openai", name: "OpenAI", defaultModel: "gpt-4o", needsKey: true, keyHint: "sk-…", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "gemini", name: "Google Gemini", defaultModel: "gemini-3.5-flash", needsKey: true, keyHint: "AIza…", keyUrl: "https://aistudio.google.com/apikey" },
  { id: "deepseek", name: "DeepSeek", defaultModel: "deepseek-chat", needsKey: true, keyUrl: "https://platform.deepseek.com/api_keys" },
  {
    id: "ollama",
    name: "Ollama (on your computer)",
    defaultModel: "llama3.2",
    needsKey: false,
    defaultBaseUrl: "http://localhost:11434/v1",
    note: "Free and private. llama3.2 runs on most laptops (about 3 GB of memory). On a computer with more memory, qwen2.5:7b or qwen2.5:14b write better plans.",
  },
  { id: "custom", name: "Other (OpenAI-compatible)", defaultModel: "", needsKey: false, defaultBaseUrl: "https://" },
];

export const providerInfo = (id: ProviderId) => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];

const SETTINGS_KEY = "apex.settings.v1";
const KEY_KEY = "apex.apiKey.v1";

const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export function loadSettings(): ModelSettings | null {
  return safe(() => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Omit<ModelSettings, "apiKey">;
    const apiKey = (s.rememberKey ? localStorage.getItem(KEY_KEY) : sessionStorage.getItem(KEY_KEY)) || "";
    return { ...s, apiKey };
  }, null);
}

export function saveSettings(s: ModelSettings) {
  safe(() => {
    const { apiKey, ...rest } = s;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest));
    // The key stays for this browser session unless the user asks to remember it.
    localStorage.removeItem(KEY_KEY);
    sessionStorage.removeItem(KEY_KEY);
    if (apiKey) (s.rememberKey ? localStorage : sessionStorage).setItem(KEY_KEY, apiKey);
  }, undefined);
}

export function isReady(s: ModelSettings | null): s is ModelSettings {
  if (!s) return false;
  const info = providerInfo(s.provider);
  if (info.needsKey && !s.apiKey.trim()) return false;
  if ((s.provider === "ollama" || s.provider === "custom") && !s.baseUrl.trim()) return false;
  if (s.provider === "custom" && !s.model.trim()) return false;
  return true;
}

export function settingsLabel(s: ModelSettings | null): string {
  if (!s) return "Choose a model";
  return s.model.trim() || providerInfo(s.provider).defaultModel || providerInfo(s.provider).name;
}
