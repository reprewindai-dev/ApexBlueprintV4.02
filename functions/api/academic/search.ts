// Cloudflare Pages Function: POST /api/academic/search (live arXiv + CrossRef, keyword-ranked)
import { searchAcademic } from "../../../src/server/academic-search";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const onRequestPost = async (context: { request: Request; env: Record<string, string | undefined> }) => {
  const body: any = await context.request.json().catch(() => null);
  if (!body?.query) return json({ error: "Missing required query string." }, 400);
  try {
    return json({ query: body.query, results: await searchAcademic(body.query, { contactEmail: context.env.CITATION_CONTACT_EMAIL }) });
  } catch (err: any) {
    return json({ error: err?.message || "Academic search failed." }, 500);
  }
};
