// Cloudflare Pages Function: POST /api/github/analyze (same logic as server.ts)
import { analyzeRepository } from "../../../src/server/github-analysis";

export const onRequestPost = async (context: { request: Request; env: Record<string, string | undefined> }) => {
  const body: any = await context.request.json().catch(() => ({}));
  try {
    return new Response(JSON.stringify(await analyzeRepository(body || {}, context.env)), { headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Repository analysis failed." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
