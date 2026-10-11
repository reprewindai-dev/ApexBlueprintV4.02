// Lets the hosted site use an Ollama server running on the visitor's own machine.
// The hosted backend (Cloudflare) cannot reach the visitor's localhost, but their browser can,
// so for a localhost Ollama URL the compile request is made from the browser with the same
// prompt, provider routing and parsing code the server uses.
import { buildBlueprintPrompts, callBlueprintModel, parseBlueprintText } from "../server/blueprint-core";
import { calculateBlueprintHash } from "./plan-ir";
export { isLocalhostUrl, shouldUseBrowserOllama } from "./ollama-url";

function unreachable(url: string, err: unknown): Error {
  const origin = typeof window !== "undefined" ? window.location.origin : "this site";
  return new Error(
    `Could not reach Ollama at ${url} from your browser (${(err as Error)?.message || err}). ` +
      `Make sure Ollama is running and allows this site: set OLLAMA_ORIGINS=${origin} and restart Ollama. ` +
      `Your browser may also ask permission to access devices on your local network.`,
  );
}

export async function compileWithBrowserOllama(input: {
  notes: string;
  codebaseContext?: string;
  targetPlatform?: string;
  userEmail?: string;
  modelName?: string;
  customUrl: string;
  constitutionVersion?: string;
  constitutionState?: string;
  selectedJurisdiction?: string;
}) {
  const startTime = Date.now();
  const { systemPrompt, userPrompt } = buildBlueprintPrompts({
    notes: input.notes,
    codebaseContext: input.codebaseContext,
    targetPlatform: input.targetPlatform,
    emailToUse: input.userEmail || "anonymous@apex.local",
    constVersion: input.constitutionVersion || "v4.02.1",
    constState: input.constitutionState || "LOCKED",
    jurisdictionProfileName: input.selectedJurisdiction || "global",
  });
  let text: string;
  try {
    text = await callBlueprintModel(
      { selectedProvider: "ollama", modelName: input.modelName, customUrl: input.customUrl, systemPrompt, userPrompt },
      {},
    );
  } catch (err) {
    if (err instanceof TypeError) throw unreachable(input.customUrl, err);
    throw err;
  }
  const parsed = parseBlueprintText(text);
  parsed.hash = calculateBlueprintHash(parsed);
  parsed.timestamp = new Date().toISOString();
  parsed.cacheStatus = { hit: false, key: "", type: "NONE", latencyMs: Date.now() - startTime };
  return parsed;
}

export async function listBrowserOllamaModels(customUrl: string) {
  const base = customUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
  const startTime = Date.now();
  try {
    const resp = await fetch(`${base}/api/tags`);
    const latencyMs = Date.now() - startTime;
    if (!resp.ok) return { success: false, latencyMs, error: `Ollama returned status ${resp.status}.` };
    const data = await resp.json();
    return { success: true, source: "browser-local-ollama", latencyMs, models: data.models || [] };
  } catch (err) {
    return { success: false, latencyMs: Date.now() - startTime, error: unreachable(base, err).message };
  }
}
