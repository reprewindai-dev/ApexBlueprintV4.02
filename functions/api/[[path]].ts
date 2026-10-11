// Cloudflare Pages Function: any /api/* route without its own function.
// Those features need the full Node server (server.ts), which the hosted site does not run.
// Return a clear JSON error instead of the HTML page the static fallback would serve.
export const onRequest = async (context: { request: Request }) => {
  const path = new URL(context.request.url).pathname;
  return new Response(
    JSON.stringify({
      error: `${path} needs the full Apex server, which is not running on this hosted site. Run the app locally (npm run dev) to use this feature.`,
      notAvailableOnHostedSite: true,
    }),
    { status: 501, headers: { "Content-Type": "application/json" } },
  );
};
