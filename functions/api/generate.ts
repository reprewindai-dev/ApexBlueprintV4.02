// Cloudflare Pages Function: POST /api/generate. Same handler as server.ts.
import { handleGenerate } from "../../src/plan/http";

export const onRequestPost = async (context: { request: Request; env: Record<string, string | undefined> }) => {
  const body = await context.request.json().catch(() => null);
  const result = await handleGenerate(body, context.env);
  return new Response(JSON.stringify(result.body), { status: result.status, headers: { "Content-Type": "application/json" } });
};
