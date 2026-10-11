// Cloudflare Pages Function: POST /api/test-harness/generate (same logic as server.ts)
import { generateBlueprintTests } from "../../../src/server/llm-tasks";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const onRequestPost = async (context: { request: Request; env: Record<string, string | undefined> }) => {
  const body: any = await context.request.json().catch(() => null);
  if (!body?.blueprint) {
    return json({ error: "Missing compiled blueprint required for generating test suites." }, 400);
  }
  try {
    return json(await generateBlueprintTests(body, context.env));
  } catch (error: any) {
    return json({ error: `Test generation failed: ${error?.message || String(error)}` }, 500);
  }
};
