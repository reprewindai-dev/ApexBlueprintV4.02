// Request handlers shared by the Cloudflare Pages Functions and the Express server.
import { callBlueprintModel, type LlmEnv } from "../server/blueprint-core";
import { generatePlan, type ModelChoice } from "./generate";
import { MAX_NOTES } from "./plan";
import { friendlyError } from "./errors";
import { readRepoContext } from "./repo";

export interface HandlerResult {
  status: number;
  body: unknown;
}

const PROVIDERS = new Set(["anthropic", "openai", "gemini", "deepseek", "ollama", "llama", "custom"]);

function readChoice(raw: unknown, env: LlmEnv): ModelChoice {
  const m = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const provider = typeof m.selectedProvider === "string" && m.selectedProvider ? m.selectedProvider : env.ABIDE_DEFAULT_PROVIDER || "";
  if (!PROVIDERS.has(provider)) throw new Error("Choose a model provider first.");
  const s = (k: string) => (typeof m[k] === "string" && (m[k] as string).trim() ? (m[k] as string).trim() : undefined);
  return {
    selectedProvider: provider,
    apiKey: s("apiKey"),
    modelName: s("modelName"),
    customUrl: localOllama(provider, s("customUrl"), env),
    authMode: s("authMode"),
  };
}

// In a container, "localhost" is the container itself. OLLAMA_LOCAL_URL (set in the Docker
// image to the host machine) replaces a localhost Ollama address sent by the browser.
function localOllama(provider: string, url: string | undefined, env: LlmEnv): string | undefined {
  if (!url || !env.OLLAMA_LOCAL_URL || (provider !== "ollama" && provider !== "llama")) return url;
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" ? env.OLLAMA_LOCAL_URL : url;
  } catch {
    return url;
  }
}

const message = (err: unknown) => friendlyError(err instanceof Error ? err.message : String(err));

export async function handleGenerate(body: unknown, env: LlmEnv): Promise<HandlerResult> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const notes = typeof b.notes === "string" ? b.notes : "";
  if (!notes.trim()) return { status: 400, body: { error: "Add some notes first." } };
  if (notes.length > MAX_NOTES) return { status: 413, body: { error: `Notes are too long (limit ${MAX_NOTES.toLocaleString()} characters).` } };
  let choice: ModelChoice;
  try {
    choice = readChoice(b.model, env);
  } catch (err) {
    return { status: 400, body: { error: message(err) } };
  }
  try {
    const repoUrl = typeof b.repoUrl === "string" ? b.repoUrl.trim() : "";
    const codebaseContext = repoUrl ? await readRepoContext(repoUrl, env.GITHUB_TOKEN) : undefined;
    const projectType = typeof b.projectType === "string" ? b.projectType : undefined;
    return { status: 200, body: await generatePlan({ notes, projectType, codebaseContext }, choice, env) };
  } catch (err) {
    return { status: 502, body: { error: message(err) } };
  }
}

export async function handleCheckModel(body: unknown, env: LlmEnv): Promise<HandlerResult> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  try {
    const choice = readChoice(b.model, env);
    await callBlueprintModel(
      { ...choice, systemPrompt: 'Reply with exactly {"ok": true}', userPrompt: "Reply now.", responseFormat: "json" },
      env,
    );
    return { status: 200, body: { ok: true } };
  } catch (err) {
    return { status: 200, body: { ok: false, error: message(err) } };
  }
}
