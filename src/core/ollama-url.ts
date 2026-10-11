// Decides when Ollama should be called from the browser (kept separate so the main bundle
// does not pull in the LLM client code from browser-ollama.ts).
const OLLAMA_PROVIDERS = new Set(["llama", "ollama"]);

export function isLocalhostUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

export function shouldUseBrowserOllama(provider?: string, url?: string): boolean {
  if (!OLLAMA_PROVIDERS.has(provider || "") || !isLocalhostUrl(url)) return false;
  const pageHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
  // When the app itself runs locally, its server can reach Ollama directly.
  return pageHost !== "localhost" && pageHost !== "127.0.0.1";
}
