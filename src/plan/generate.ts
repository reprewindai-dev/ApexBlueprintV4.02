// One plan generation path for every surface: the Express server, the Cloudflare Pages
// Function and the browser (for an Ollama running on the visitor's own machine).
import { callBlueprintModel, type BlueprintModelOptions, type LlmEnv } from "../server/blueprint-core";
import { buildPlanPrompts, MAX_NOTES, parsePlanText, PLAN_SCHEMA, type PlanInput, type PlanRecord, type TokenUsage } from "./plan";

export type ModelChoice = Pick<
  BlueprintModelOptions,
  "selectedProvider" | "apiKey" | "modelName" | "customUrl" | "authMode" | "customHeaderName"
>;

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-opus-5-5",
  openai: "gpt-4o",
  gemini: "gemini-3.5-flash",
  deepseek: "deepseek-chat",
  ollama: "qwen2.5:14b",
  llama: "qwen2.5:14b",
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
  if (input.notes.length > MAX_NOTES) throw new Error(`Notes are too long (limit ${MAX_NOTES.toLocaleString()} characters).`);
  const { systemPrompt, userPrompt } = buildPlanPrompts(input);
  let usage: TokenUsage | undefined;
  const text = await callBlueprintModel(
    { ...choice, systemPrompt, userPrompt, responseFormat: "json", jsonSchema: PLAN_SCHEMA, onUsage: (u) => (usage = u) },
    env,
  );
  const { plan, missing } = parsePlanText(text);
  return {
    id: newId(),
    createdAt: new Date().toISOString(),
    notes: input.notes,
    model: modelLabel(choice),
    plan,
    missing,
    ...(usage ? { usage } : {}),
  };
}
