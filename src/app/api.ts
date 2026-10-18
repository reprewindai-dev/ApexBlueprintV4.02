// Asks for a plan: through the Apex server, or straight from the browser when the
// model is an Ollama on the visitor's own computer (the hosted server cannot reach it).
import type { PlanRecord } from "../plan/plan";
import type { ModelChoice } from "../plan/generate";
import { shouldUseBrowserOllama } from "../core/ollama-url";
import { friendlyError } from "../plan/errors";
import type { ModelSettings } from "./settings";
import { diagnoseOllama, OllamaConnectionError } from "./ollama";

export interface PlanRequest {
  notes: string;
  projectType?: string;
  repoUrl?: string;
}

export function toModelChoice(s: ModelSettings): ModelChoice {
  return {
    selectedProvider: s.provider,
    apiKey: s.apiKey.trim() || undefined,
    modelName: s.model.trim() || undefined,
    customUrl: s.provider === "ollama" || s.provider === "custom" ? s.baseUrl.trim() : undefined,
    authMode: s.provider === "ollama" || (s.provider === "custom" && !s.apiKey.trim()) ? "none" : "bearer",
  };
}

async function ollamaError(baseUrl: string): Promise<Error> {
  const state = await diagnoseOllama(baseUrl);
  if (state === "ok") return new Error("Ollama is reachable, but the request failed. Try again.");
  return new OllamaConnectionError(state, baseUrl);
}

export async function requestPlan(req: PlanRequest, settings: ModelSettings): Promise<PlanRecord> {
  const choice = toModelChoice(settings);

  if (shouldUseBrowserOllama("ollama", settings.provider === "ollama" ? settings.baseUrl : undefined)) {
    const [{ generatePlan }, { readRepoContext }] = await Promise.all([import("../plan/generate"), import("../plan/repo")]);
    const codebaseContext = req.repoUrl?.trim() ? await readRepoContext(req.repoUrl) : undefined;
    try {
      return await generatePlan({ notes: req.notes, projectType: req.projectType, codebaseContext }, choice, {});
    } catch (err) {
      if (err instanceof TypeError) throw await ollamaError(settings.baseUrl);
      throw new Error(friendlyError((err as Error).message));
    }
  }

  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...req, model: choice }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `The server could not write the plan (HTTP ${response.status}).`);
  return body as PlanRecord;
}

export async function checkModel(settings: ModelSettings): Promise<{ ok: boolean; message: string; error?: Error }> {
  try {
    await requestCheck(settings);
    return { ok: true, message: "Connected." };
  } catch (err) {
    return { ok: false, message: (err as Error).message, error: err as Error };
  }
}

async function requestCheck(settings: ModelSettings) {
  const choice = toModelChoice(settings);
  if (shouldUseBrowserOllama("ollama", settings.provider === "ollama" ? settings.baseUrl : undefined)) {
    const base = settings.baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
    let resp: Response;
    try {
      resp = await fetch(`${base}/api/tags`);
    } catch {
      throw await ollamaError(settings.baseUrl);
    }
    if (!resp.ok) throw new Error(`Ollama answered with HTTP ${resp.status}.`);
    const tags = (await resp.json()) as { models?: { name: string }[] };
    const names = (tags.models || []).map((m) => m.name);
    const wanted = settings.model.trim() || "qwen2.5:14b";
    if (!names.some((n) => n === wanted || n.split(":")[0] === wanted)) {
      throw new Error(`Ollama is running but does not have "${wanted}". Run: ollama pull ${wanted}`);
    }
    return;
  }
  const response = await fetch("/api/check-model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: choice }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) throw new Error(body.error || body.message || `Check failed (HTTP ${response.status}).`);
}
