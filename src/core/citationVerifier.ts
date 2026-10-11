export enum VerificationStatus {
  VERIFIED_MATCH = "VERIFIED_MATCH",               // real record found, title + author match
  TITLE_AUTHOR_MISMATCH = "TITLE_AUTHOR_MISMATCH", // real record exists, but doesn't match the claim
  NOT_FOUND = "NOT_FOUND",                         // no matching record in any source
  NO_QUERY_PROVIDED = "NO_QUERY_PROVIDED",          // nothing to check (no id, no title)
}

export interface RealRecord {
  source: string;
  title: string;
  authors: string[];
  identifier: string; // arXiv ID, DOI, or Semantic Scholar paperId / OpenAlex ID
  url: string;
}

export interface CitationVerification {
  status: VerificationStatus;
  claimed_title: string;
  claimed_authors: string[];
  real_record?: RealRecord | null;
  checked_sources: string[];
  notes: string;
}

const TITLE_MATCH_THRESHOLD = 85;

function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Token sort ratio fuzzy string comparison (0 to 100)
 */
function tokenSortRatio(str1: string, str2: string): number {
  const norm1 = normalize(str1);
  const norm2 = normalize(str2);
  if (norm1 === norm2) return 100;
  if (!norm1 || !norm2) return 0;

  const tokens1 = Array.from(new Set(norm1.split(" "))).sort();
  const tokens2 = Array.from(new Set(norm2.split(" "))).sort();

  const sorted1 = tokens1.join(" ");
  const sorted2 = tokens2.join(" ");

  return levenshteinRatio(sorted1, sorted2);
}

function partialRatio(str1: string, str2: string): number {
  const norm1 = normalize(str1);
  const norm2 = normalize(str2);
  if (!norm1 || !norm2) return 0;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 100;

  const shorter = norm1.length <= norm2.length ? norm1 : norm2;
  const longer = norm1.length <= norm2.length ? norm2 : norm1;

  let maxRatio = 0;
  const len = shorter.length;
  for (let i = 0; i <= longer.length - len; i++) {
    const sub = longer.substring(i, i + len);
    const r = levenshteinRatio(shorter, sub);
    if (r > maxRatio) maxRatio = r;
  }
  return maxRatio;
}

function levenshteinRatio(s1: string, s2: string): number {
  if (s1 === s2) return 100;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const track = Array(len2 + 1).fill(0).map((_, i) => i);
  let key: number;

  for (let i = 1; i <= len1; i++) {
    let last = i - 1;
    track[0] = i;
    for (let j = 1; j <= len2; j++) {
      const temp = track[j];
      if (s1[i - 1] === s2[j - 1]) {
        key = last;
      } else {
        key = Math.min(last, track[j], track[j - 1]) + 1;
      }
      last = temp;
      track[j] = key;
    }
  }

  const distance = track[len2];
  const maxLen = Math.max(len1, len2);
  return Math.round(((maxLen - distance) / maxLen) * 100);
}

function authorsOverlap(claimed: string[], real: string[]): boolean {
  if (!claimed || !claimed.length || !real || !real.length) return false;
  const realNorm = real.map(normalize);
  for (const c of claimed) {
    const cNorm = normalize(c);
    for (const r of realNorm) {
      if (partialRatio(cNorm, r) >= 80) {
        return true;
      }
    }
  }
  return false;
}

function scoreMatch(claimedTitle: string, real: RealRecord, claimedAuthors: string[]): VerificationStatus {
  const titleScore = tokenSortRatio(claimedTitle, real.title);
  const authorsMatch = authorsOverlap(claimedAuthors, real.authors);
  if (titleScore >= TITLE_MATCH_THRESHOLD && authorsMatch) {
    return VerificationStatus.VERIFIED_MATCH;
  }
  return VerificationStatus.TITLE_AUTHOR_MISMATCH;
}

// --- Live Source Fetchers ---
// Each fetcher returns up to CANDIDATES records so a near-duplicate title ranked first
// (e.g. "Is Attention All You Need?") does not hide the real paper.

const CANDIDATES = 5;

export interface CitationSourceKeys {
  semanticScholarApiKey?: string;
  openAlexApiKey?: string;
  contactEmail?: string;
}

type FetchResult = { records: RealRecord[]; rateLimited: boolean };

const empty = (rateLimited = false): FetchResult => ({ records: [], rateLimited });

function parseArxivEntries(xml: string): RealRecord[] {
  const out: RealRecord[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRegex.exec(xml)) !== null) {
    const content = m[1];
    const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/);
    const title = (titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "").replace(/^Title:\s*/i, "");
    if (!title || /^Error$/i.test(title)) continue;
    const authors: string[] = [];
    const authorRegex = /<name>([\s\S]*?)<\/name>/g;
    let a: RegExpExecArray | null;
    while ((a = authorRegex.exec(content)) !== null) authors.push(a[1].trim());
    const idMatch = content.match(/<id>([\s\S]*?)<\/id>/);
    const url = idMatch ? idMatch[1].trim() : "";
    out.push({ source: "arxiv", title, authors, identifier: url.replace(/^https?:\/\/arxiv\.org\/abs\//, ""), url });
  }
  return out;
}

export async function fetchArxiv(arxivId: string): Promise<RealRecord | null> {
  try {
    const cleanId = arxivId.replace(/^arxiv:/i, "").replace(/^https?:\/\/arxiv\.org\/abs\//i, "").trim();
    const resp = await fetch(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(cleanId)}&max_results=1`);
    if (!resp.ok) return null;
    return parseArxivEntries(await resp.text())[0] || null;
  } catch {
    return null;
  }
}

export async function searchArxivByTitle(title: string): Promise<FetchResult> {
  try {
    const q = `ti:"${title.replace(/["]/g, "")}"`;
    const resp = await fetch(`https://export.arxiv.org/api/query?search_query=${encodeURIComponent(q)}&max_results=${CANDIDATES}`);
    if (!resp.ok) return empty(resp.status === 429 || resp.status === 503);
    return { records: parseArxivEntries(await resp.text()), rateLimited: false };
  } catch {
    return empty();
  }
}

export async function fetchSemanticScholar(title: string, keys: CitationSourceKeys = {}): Promise<FetchResult> {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(title)}&limit=${CANDIDATES}&fields=title,authors,externalIds,url`;
    const headers: Record<string, string> = { "User-Agent": "CitationVerifier/1.0" };
    if (keys.semanticScholarApiKey) headers["x-api-key"] = keys.semanticScholarApiKey;
    const resp = await fetch(url, { headers });
    if (!resp.ok) return empty(resp.status === 429);
    const data: any = await resp.json();
    return {
      rateLimited: false,
      records: (data.data || []).map((top: any) => ({
        source: "semantic_scholar",
        title: top.title || "",
        authors: (top.authors || []).map((a: any) => a.name).filter(Boolean),
        identifier: top.paperId || "",
        url: top.url || `https://www.semanticscholar.org/paper/${top.paperId}`,
      })),
    };
  } catch {
    return empty();
  }
}

function crossRefRecord(top: any): RealRecord | null {
  const titles = top.title || [];
  if (!titles.length) return null;
  return {
    source: "crossref",
    title: titles[0],
    authors: (top.author || []).map((a: any) => `${a.given || ""} ${a.family || ""}`.trim()).filter(Boolean),
    identifier: top.DOI || "",
    url: top.URL || `https://doi.org/${top.DOI}`,
  };
}

function crossRefHeaders(keys: CitationSourceKeys): Record<string, string> {
  return { "User-Agent": `CitationVerifier/1.0${keys.contactEmail ? ` (mailto:${keys.contactEmail})` : ""}` };
}

export async function fetchCrossRef(title: string, keys: CitationSourceKeys = {}): Promise<FetchResult> {
  try {
    const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(title)}&rows=${CANDIDATES}`;
    const resp = await fetch(url, { headers: crossRefHeaders(keys) });
    if (!resp.ok) return empty(resp.status === 429);
    const data: any = await resp.json();
    return { rateLimited: false, records: (data.message?.items || []).map(crossRefRecord).filter(Boolean) as RealRecord[] };
  } catch {
    return empty();
  }
}

export async function fetchCrossRefByDoi(doi: string, keys: CitationSourceKeys = {}): Promise<RealRecord | null> {
  try {
    const clean = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim();
    const resp = await fetch(`https://api.crossref.org/works/${encodeURIComponent(clean)}`, { headers: crossRefHeaders(keys) });
    if (!resp.ok) return null;
    const data: any = await resp.json();
    return data.message ? crossRefRecord(data.message) : null;
  } catch {
    return null;
  }
}

export async function fetchOpenAlex(title: string, keys: CitationSourceKeys = {}): Promise<FetchResult> {
  try {
    let url = `https://api.openalex.org/works?search=${encodeURIComponent(title)}&per_page=${CANDIDATES}`;
    if (keys.openAlexApiKey) url += `&api_key=${encodeURIComponent(keys.openAlexApiKey)}`;
    if (keys.contactEmail) url += `&mailto=${encodeURIComponent(keys.contactEmail)}`;
    const resp = await fetch(url);
    if (!resp.ok) return empty(resp.status === 429);
    const data: any = await resp.json();
    return {
      rateLimited: false,
      records: (data.results || []).map((top: any) => ({
        source: "openalex",
        title: top.title || "",
        authors: (top.authorships || []).map((a: any) => a.author?.display_name).filter(Boolean),
        identifier: top.id || "",
        url: top.doi || top.id || "",
      })),
    };
  } catch {
    return empty();
  }
}

/**
 * Checks the claim against arXiv (by ID, then by title), the DOI if given, CrossRef,
 * OpenAlex and Semantic Scholar. A claim is VERIFIED_MATCH only when a real record's
 * title and at least one author match. Sources that were rate-limited are reported as such.
 */
export async function verifyCitation(
  claimedTitle: string,
  claimedAuthors: string[],
  arxivId?: string,
  doi?: string,
  keys: CitationSourceKeys = {}
): Promise<CitationVerification> {
  if (!claimedTitle && !arxivId && !doi) {
    return {
      status: VerificationStatus.NO_QUERY_PROVIDED,
      claimed_title: claimedTitle,
      claimed_authors: claimedAuthors,
      checked_sources: [],
      notes: "No title, arXiv ID, or DOI provided — nothing to verify.",
    };
  }

  const checkedSources: string[] = [];
  const result = (status: VerificationStatus, real: RealRecord | null, notes: string): CitationVerification => ({
    status,
    claimed_title: claimedTitle,
    claimed_authors: claimedAuthors,
    real_record: real,
    checked_sources: checkedSources,
    notes,
  });

  // Identifier lookups: the record either matches the claim or it does not.
  if (arxivId) {
    checkedSources.push("arxiv");
    const real = await fetchArxiv(arxivId);
    if (real) {
      const status = scoreMatch(claimedTitle, real, claimedAuthors);
      return result(status, real, status === VerificationStatus.TITLE_AUTHOR_MISMATCH
        ? `arXiv:${arxivId} exists but is titled "${real.title}" by [${real.authors.join(", ")}] — does not match the claim.`
        : `Verified matching record found on arXiv:${arxivId}.`);
    }
    checkedSources.push("arxiv:id_not_found");
  }
  if (doi) {
    checkedSources.push("crossref:doi");
    const real = await fetchCrossRefByDoi(doi, keys);
    if (real) {
      const status = scoreMatch(claimedTitle, real, claimedAuthors);
      return result(status, real, status === VerificationStatus.TITLE_AUTHOR_MISMATCH
        ? `DOI ${doi} exists but is titled "${real.title}" by [${real.authors.join(", ")}] — does not match the claim.`
        : `Verified matching record found for DOI ${doi}.`);
    }
    checkedSources.push("crossref:doi_not_found");
  }

  if (!claimedTitle) {
    return result(VerificationStatus.NOT_FOUND, null, "Identifier could not be resolved and no title was given to search.");
  }

  const searches: Array<[string, () => Promise<FetchResult>]> = [
    ["arxiv", () => searchArxivByTitle(claimedTitle)],
    ["crossref", () => fetchCrossRef(claimedTitle, keys)],
    ["openalex", () => fetchOpenAlex(claimedTitle, keys)],
    ["semantic_scholar", () => fetchSemanticScholar(claimedTitle, keys)],
  ];

  let closest: { real: RealRecord; score: number } | null = null;
  for (const [sourceName, search] of searches) {
    const { records, rateLimited } = await search();
    checkedSources.push(rateLimited ? `${sourceName}:rate_limited` : sourceName);
    for (const real of records) {
      if (scoreMatch(claimedTitle, real, claimedAuthors) === VerificationStatus.VERIFIED_MATCH) {
        return result(VerificationStatus.VERIFIED_MATCH, real, `Verified matching record found on ${sourceName}.`);
      }
      const score = tokenSortRatio(claimedTitle, real.title);
      if (!closest || score > closest.score) closest = { real, score };
    }
  }

  if (closest && closest.score >= TITLE_MATCH_THRESHOLD) {
    return result(VerificationStatus.TITLE_AUTHOR_MISMATCH, closest.real,
      `A record titled "${closest.real.title}" exists (${closest.real.source}), but its authors [${closest.real.authors.slice(0, 5).join(", ")}] do not match the claimed authors.`);
  }
  const limited = checkedSources.filter((c) => c.endsWith(":rate_limited"));
  return result(VerificationStatus.NOT_FOUND, null,
    `No matching real record found in any checked source.${limited.length ? ` Rate-limited (not checked): ${limited.map((c) => c.split(":")[0]).join(", ")}.` : ""}`);
}
