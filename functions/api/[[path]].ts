// Cloudflare Pages Function: any other /api/* path.
export const onRequest = () =>
  new Response(JSON.stringify({ error: "Not found." }), { status: 404, headers: { "Content-Type": "application/json" } });
