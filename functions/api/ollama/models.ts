// Cloudflare Pages Function: POST /api/ollama/models
// Lists models on a publicly reachable Ollama server. An Ollama on the visitor's own machine
// (localhost) is queried from the browser instead; see src/core/browser-ollama.ts.
export const onRequestPost = async (context: { request: Request; env: Record<string, string | undefined> }) => {
  const body: any = await context.request.json().catch(() => ({}));
  const rawUrl: string = body?.customUrl || context.env.OLLAMA_BASE_URL || "";
  const reply = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
  if (!rawUrl) return reply({ success: false, error: "Enter your Ollama server URL under LLM Engine." });
  const baseUrl = rawUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
  const startTime = Date.now();
  try {
    const resp = await fetch(`${baseUrl}/api/tags`);
    const latencyMs = Date.now() - startTime;
    if (!resp.ok) return reply({ success: false, latencyMs, error: `Ollama returned status ${resp.status}.` });
    const data: any = await resp.json();
    return reply({ success: true, source: "remote-ollama", latencyMs, models: data.models || [] });
  } catch {
    return reply({ success: false, latencyMs: Date.now() - startTime, error: `Could not reach Ollama at ${baseUrl}.` });
  }
};
