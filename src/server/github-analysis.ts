// Repository analysis shared by server.ts and the Cloudflare Pages Function.
// Reads the real file tree from the GitHub API and asks the configured model to compare it
// with the user's notes. If the repository cannot be read, it fails with that error;
// it never analyses an invented file list.
import { callBlueprintModel, type LlmEnv } from "./blueprint-core";
import type { ProviderSettings } from "./llm-tasks";

export function parseRepo(repoUrl: string): { owner: string; repo: string } | null {
  const m = repoUrl.trim().match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+)/i) || repoUrl.trim().match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/i, "") };
}

async function readRepoTree(owner: string, repo: string, token?: string) {
  const headers: Record<string, string> = { "User-Agent": "APEX-Compiler", Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const meta = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!meta.ok) {
    const hint = meta.status === 404 ? " (not found, or private: add a GitHub token)" : meta.status === 403 ? " (rate-limited or forbidden: add a GitHub token)" : "";
    throw new Error(`Could not read ${owner}/${repo}: GitHub returned ${meta.status}${hint}.`);
  }
  const info: any = await meta.json();
  const branch = info.default_branch || "main";
  const tree = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, { headers });
  if (!tree.ok) throw new Error(`Could not read the file tree of ${owner}/${repo}@${branch}: GitHub returned ${tree.status}.`);
  const data: any = await tree.json();
  const files: string[] = (data.tree || []).filter((n: any) => n.type === "blob").map((n: any) => n.path);
  return { branch, files, truncated: Boolean(data.truncated) };
}

function detectStack(files: string[]): string[] {
  const has = (re: RegExp) => files.some((p) => re.test(p));
  const out: string[] = [];
  if (has(/(^|\/)package\.json$/)) out.push("Node.js / JavaScript");
  if (has(/\.tsx?$/)) out.push("TypeScript");
  if (has(/(^|\/)Cargo\.toml$/) || has(/\.rs$/)) out.push("Rust");
  if (has(/\.py$/) || has(/(^|\/)(requirements\.txt|pyproject\.toml)$/)) out.push("Python");
  if (has(/\.go$/)) out.push("Go");
  if (has(/\.sol$/)) out.push("Solidity");
  if (has(/\.(java|kt)$/)) out.push("JVM (Java/Kotlin)");
  if (has(/(^|\/)Dockerfile$/)) out.push("Docker");
  return out;
}

export async function analyzeRepository(
  input: { repoUrl: string; notes?: string; businessPlanText?: string; customToken?: string } & ProviderSettings,
  env: LlmEnv,
) {
  const parsed = parseRepo(input.repoUrl || "");
  if (!parsed) throw new Error("Enter a GitHub repository as https://github.com/owner/repo or owner/repo.");
  const { owner, repo } = parsed;
  const { branch, files, truncated } = await readRepoTree(owner, repo, input.customToken || env.GITHUB_TOKEN);
  const technologiesFound = detectStack(files);

  const crossRefPrompt = `You are a software analyst. Compare this real GitHub repository with the user's proposed business logic.
Only describe files, endpoints and code that the file list supports; when something is inferred rather than seen, say so.

Repository: ${owner}/${repo} (branch ${branch}, ${files.length} files${truncated ? ", list truncated by GitHub" : ""})
Detected technologies (from file names): ${technologiesFound.join(", ") || "none detected"}
File paths (first 200):
${files.slice(0, 200).map((f) => `  - ${f}`).join("\n")}

User's notes:
"${(input.notes || "None provided").substring(0, 3000)}"

Generated business plan text:
"${(input.businessPlanText || "None provided").substring(0, 1500)}"

Evaluate how the codebase can implement or currently implements the business logic. Highlight endpoints, missing libraries, security risks, and concrete steps to bridge the gaps.

You must return a valid JSON object matching this schema exactly:
{
  "repoName": "${owner}/${repo}",
  "techStack": ["Stack names (e.g. React, Rust)"],
  "endpoints": [
    { "path": "/api/route", "method": "GET/POST", "purpose": "Explanation of purpose" }
  ],
  "alignments": [
    { "feature": "Feature Title", "status": "Fully Supported / Partially Supported / Missing", "details": "How the code aligns" }
  ],
  "gaps": [
    { "system": "Subsystem", "missing": "Details of what is missing", "severity": "Critical / Medium" }
  ],
  "expansionSteps": [
    { "filePath": "path/to/create.ext", "instructions": "Copy-pasteable directions to build this file and its dependencies" }
  ],
  "authPatterns": "Details of authentication structures, credentials flow, token scopes, or zero-knowledge handshakes found or required",
  "dtos": [
    { "name": "DTO / Struct Name", "fields": ["field_name: type"], "purpose": "Request/Response serialization boundary role" }
  ],
  "databaseModels": [
    { "modelName": "Model Name", "fields": ["field: type"], "purpose": "Table schema or state representation details" }
  ],
  "migrations": [
    { "name": "Migration Name/ID", "status": "Executed / Required", "details": "DB schema alterations or state conversions required" }
  ],
  "backgroundJobs": [
    { "name": "Job Name", "interval": "e.g. Hourly / Every 10s", "purpose": "Asynchronous background routine role" }
  ],
  "queuesEvents": [
    { "name": "Queue/Event Name", "purpose": "Asynchronous messaging or inter-module event trigger" }
  ],
  "testsPresent": [
    { "name": "Test Suite Name", "status": "Present / Absent", "type": "Unit / Integration / SLA Verification" }
  ],
  "envVars": [
    { "name": "ENV_VAR_NAME", "required": true, "purpose": "Usage role in the application runtime config" }
  ],
  "externalDependencies": [
    { "name": "Dependency Name", "purpose": "Third party library or API role in compilation" }
  ],
  "serviceBoundaries": [
    { "name": "Service Name", "responsibilities": "Sovereign boundary limits" }
  ],
  "inferredCapabilities": [
    { "id": "capability-id", "name": "Capability Name", "alignment": "How the repository maps to this Capability ID" }
  ],
  "inferredMonetizableSurfaces": [
    { "name": "Monetized Flow", "unit": "Billing unit", "floorPrice": 0.005, "rationale": "Why this surface could be billed" }
  ],
  "inferredMissingControls": [
    { "system": "Control System", "missing": "Details of missing security, budget limits, or audit guardrails in the repository codebase" }
  ]
}`;

  const text = await callBlueprintModel(
    {
      selectedProvider: input.provider || env.ABIDE_DEFAULT_PROVIDER || "gemini",
      apiKey: input.apiKey,
      modelName: input.modelName,
      customUrl: input.customUrl,
      authMode: input.authMode,
      customHeaderName: input.customHeaderName,
      systemPrompt: "You return only a single JSON object.",
      userPrompt: crossRefPrompt,
    },
    env,
  );
  let analysis: any;
  try {
    analysis = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("The model did not return a JSON analysis.");
    analysis = JSON.parse(m[0]);
  }
  return { ...analysis, repoName: `${owner}/${repo}`, detectedTechnologies: technologiesFound, isRealConnection: true, totalFilesCount: files.length, branch };
}
