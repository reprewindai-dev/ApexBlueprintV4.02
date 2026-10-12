// Reads a public GitHub repository's file list so a plan can build on existing code.
// Works in the browser, on Cloudflare and in Node.

export function parseRepo(repoUrl: string): { owner: string; repo: string } | null {
  const m = repoUrl.trim().match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+)/i) || repoUrl.trim().match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/i, "") };
}

const MAX_PATHS = 400;

export async function readRepoContext(repoUrl: string, token?: string): Promise<string> {
  const parsed = parseRepo(repoUrl);
  if (!parsed) throw new Error("That does not look like a GitHub repository link (github.com/owner/repo).");
  const { owner, repo } = parsed;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const meta = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!meta.ok) {
    const why = meta.status === 404 ? "it was not found or is private" : meta.status === 403 ? "GitHub is rate-limiting requests" : `GitHub returned ${meta.status}`;
    throw new Error(`Could not read ${owner}/${repo}: ${why}.`);
  }
  const info = (await meta.json()) as { default_branch?: string; description?: string };
  const branch = info.default_branch || "main";
  const treeResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, { headers });
  if (!treeResp.ok) throw new Error(`Could not read the files of ${owner}/${repo}: GitHub returned ${treeResp.status}.`);
  const tree = (await treeResp.json()) as { tree?: { type: string; path: string }[]; truncated?: boolean };
  const files = (tree.tree || [])
    .filter((n) => n.type === "blob" && !/(^|\/)(node_modules|dist|build|vendor|\.git)\//.test(n.path))
    .map((n) => n.path);

  const shown = files.slice(0, MAX_PATHS);
  return [
    `Repository: ${owner}/${repo} (branch ${branch})${info.description ? ` - ${info.description}` : ""}`,
    `Files (${files.length}${files.length > shown.length || tree.truncated ? `, first ${shown.length} shown` : ""}):`,
    ...shown,
  ].join("\n");
}
