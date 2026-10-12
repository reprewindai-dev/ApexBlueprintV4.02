// One plan generation path for every surface: the Express server, the Cloudflare Pages
// Function and the browser (for an Ollama running on the visitor's own machine).
import { callBlueprintModel, type BlueprintModelOptions, type LlmEnv } from "../server/blueprint-core";
import { buildPlanPrompts, parsePlanText, type PlanInput, type PlanRecord } from "./plan";

export type ModelChoice = Pick<
  BlueprintModelOptions,
  "selectedProvider" | "apiKey" | "modelName" | "customUrl" | "authMode" | "customHeaderName"
>;

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-opus-5-5",
  openai: "gpt-4o",
  gemini: "gemini-3.5-flash",
  deepseek: "deepseek-chat",
  ollama: "llama3.2",
  llama: "llama3.2",
};

export function modelLabel(choice: ModelChoice): string {
  return choice.modelName?.trim() || DEFAULT_MODELS[choice.selectedProvider] || choice.selectedProvider;
}

function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID() : `plan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function generatePlan(input: PlanInput, choice: ModelChoice, env: LlmEnv): Promise<PlanRecord> {
  if (!input.notes?.trim()) throw new Error("Add some notes first.");
  const { systemPrompt, userPrompt } = buildPlanPrompts(input);
  const text = await callBlueprintModel({ ...choice, systemPrompt, userPrompt, responseFormat: "json" }, env);
  const { plan, missing } = parsePlanText(text);
  return {
    id: newId(),
    createdAt: new Date().toISOString(),
    notes: input.notes,
    model: modelLabel(choice),
    plan,
    missing,
  };
}
