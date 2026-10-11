// Cloudflare Pages Function: POST /api/academic/verify
// Checks a claimed citation against arXiv, CrossRef, OpenAlex and Semantic Scholar using
// the same verifier as server.ts. Optional Pages env vars: SEMANTIC_SCHOLAR_API_KEY,
// OPENALEX_API_KEY, CITATION_CONTACT_EMAIL (unkeyed requests are often rate-limited).
import { verifyCitation, VerificationStatus } from "../../../src/core/citationVerifier";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const onRequestPost = async (context: { request: Request; env: Record<string, string | undefined> }) => {
  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Request body must be JSON." }, 400);
  }
  try {
    const { title, authors, resolvableIdentifier, arxivId, doi } = body || {};
    const claimedTitle = title || "";
    const claimedAuthors = Array.isArray(authors) ? authors : authors ? [authors] : [];
    const id = typeof resolvableIdentifier === "string" ? resolvableIdentifier : "";
    const claimedArxivId = arxivId || (id.includes("arxiv") ? id : undefined);
    const claimedDoi = doi || (/doi\.org\//i.test(id) ? id : undefined);

    const verification = await verifyCitation(claimedTitle, claimedAuthors, claimedArxivId, claimedDoi, {
      semanticScholarApiKey: context.env.SEMANTIC_SCHOLAR_API_KEY,
      openAlexApiKey: context.env.OPENALEX_API_KEY,
      contactEmail: context.env.CITATION_CONTACT_EMAIL,
    });
    const isMatch = verification.status === VerificationStatus.VERIFIED_MATCH;
    const realRec = verification.real_record;

    return json({
      success: isMatch,
      status: verification.status,
      message: verification.notes,
      checkedSources: verification.checked_sources,
      paper: realRec
        ? {
            title: realRec.title,
            authors: realRec.authors.join(", "),
            url: realRec.url,
            identifier: realRec.identifier,
            source: realRec.source,
            verificationStatus: isMatch ? "VERIFIED" : "TITLE_AUTHOR_MISMATCH",
            digitalSignature: await sha256Hex(realRec.title + realRec.authors.join(",") + realRec.url),
          }
        : null,
    });
  } catch (err: any) {
    return json({ error: err?.message || "Citation verification failed." }, 500);
  }
};
