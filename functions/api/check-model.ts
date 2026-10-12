// Cloudflare Pages Function: POST /api/check-model. Same handler as server.ts.
import { handleCheckModel } from "../../src/plan/http";

export const onRequestPost = async (context: { request: Request; env: Record<string, string | undefined> }) => {
  const body = await context.request.json().catch(() => null);
  const result = await handleCheckModel(body, context.env);
  return new Response(JSON.stringify(result.body), { status: result.status, headers: { "Content-Type": "application/json" } });
};
