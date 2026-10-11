// Live academic search shared by server.ts and the Cloudflare Pages Function.
// Results come from arXiv and CrossRef at request time and are ranked by a plain
// keyword-overlap score (scoreType: "keyword"); no vectors are invented.

export interface AcademicSearchResult {
  title: string;
  authors: string;
  source: string;
  summary: string;
  relevance: string;
  url: string;
  score: number;
  scoreType: "keyword";
}

const STOPWORDS = new Set(["a", "an", "and", "the", "of", "for", "in", "on", "to", "with", "by", "is", "are", "at", "from", "as"]);

function tokens(text: string): string[] {
  return (text || "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// Share of query terms that appear in the title (weighted 2x) or summary, 0..1.
export function keywordScore(query: string, title: string, summary: string): number {
  const q = Array.from(new Set(tokens(query)));
  if (!q.length) return 0;
  const titleSet = new Set(tokens(title));
  const summarySet = new Set(tokens(summary));
  let hits = 0;
  for (const t of q) hits += titleSet.has(t) ? 2 : summarySet.has(t) ? 1 : 0;
  return Math.round((hits / (q.length * 2)) * 1000) / 1000;
}

async function searchArxiv(query: string): Promise<Omit<AcademicSearchResult, "score" | "scoreType">[]> {
  try {
    const resp = await fetch(`https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=8`);
    if (!resp.ok) return [];
    const xml = await resp.text();
    const out: Omit<AcademicSearchResult, "score" | "scoreType">[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let m: RegExpExecArray | null;
    while ((m = entryRegex.exec(xml)) !== null) {
      const c = m[1];
      const title = (c.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "").replace(/\s+/g, " ").trim();
      if (!title) continue;
      const authors: string[] = [];
      const authorRegex = /<name>([\s\S]*?)<\/name>/g;
      let a: RegExpExecArray | null;
      while ((a = authorRegex.exec(c)) !== null) authors.push(a[1].trim());
      out.push({
        title,
        authors: authors.join(", "),
        source: "arXiv (retrieved live)",
        summary: (c.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] || "").replace(/\s+/g, " ").trim(),
        relevance: `arXiv search result for "${query}".`,
        url: (c.match(/<id>([\s\S]*?)<\/id>/)?.[1] || "").trim(),
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function searchCrossRef(query: string, contactEmail?: string): Promise<Omit<AcademicSearchResult, "score" | "scoreType">[]> {
  try {
    const resp = await fetch(`https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=8&select=title,author,DOI,URL,abstract`, {
      headers: { "User-Agent": `ApexAcademicSearch/1.0${contactEmail ? ` (mailto:${contactEmail})` : ""}` },
    });
    if (!resp.ok) return [];
    const data: any = await resp.json();
    return (data.message?.items || [])
      .filter((it: any) => it.title?.[0])
      .map((it: any) => ({
        title: it.title[0],
        authors: (it.author || []).map((a: any) => `${a.given || ""} ${a.family || ""}`.trim()).filter(Boolean).join(", "),
        source: "CrossRef (retrieved live)",
        summary: (it.abstract || "No abstract available.").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        relevance: `CrossRef search result for "${query}".`,
        url: it.URL || (it.DOI ? `https://doi.org/${it.DOI}` : ""),
      }));
  } catch {
    return [];
  }
}

export async function searchAcademic(
  query: string,
  options: { contactEmail?: string; extraPapers?: Omit<AcademicSearchResult, "score" | "scoreType">[] } = {},
): Promise<AcademicSearchResult[]> {
  const [arxiv, crossref] = await Promise.all([searchArxiv(query), searchCrossRef(query, options.contactEmail)]);
  const seen = new Set<string>();
  const all = [...(options.extraPapers || []), ...arxiv, ...crossref].filter((p) => {
    const key = p.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return all
    .map((p) => ({ ...p, score: keywordScore(query, p.title, p.summary), scoreType: "keyword" as const }))
    .sort((a, b) => b.score - a.score);
}
