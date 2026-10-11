// Cloudflare Pages Function: POST /api/test-connection (same logic as server.ts)
import { testProviderConnection } from "../../src/server/llm-tasks";

export const onRequestPost = async (context: { request: Request; env: Record<string, string | undefined> }) => {
  const body = await context.request.json().catch(() => ({}));
  const result = await testProviderConnection(body || {}, context.env);
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
};
