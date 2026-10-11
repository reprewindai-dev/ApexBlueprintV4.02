// Small LLM tasks shared by server.ts and the Cloudflare Pages Functions.
// Like blueprint-core.ts, this must not import Node-only modules.
import { callBlueprintModel, type LlmEnv } from "./blueprint-core";

export interface ProviderSettings {
  provider?: string;
  apiKey?: string;
  modelName?: string;
  customUrl?: string;
  authMode?: string;
  customHeaderName?: string;
}

function resolveProvider(settings: ProviderSettings, env: LlmEnv) {
  return {
    selectedProvider: settings.provider || env.ABIDE_DEFAULT_PROVIDER || "gemini",
    apiKey: settings.apiKey,
    modelName: settings.modelName,
    customUrl: settings.customUrl,
    authMode: settings.authMode,
    customHeaderName: settings.customHeaderName,
  };
}

// Sends a minimal request to the configured provider and reports whether it answered.
export async function testProviderConnection(settings: ProviderSettings, env: LlmEnv) {
  const startTime = Date.now();
  try {
    await callBlueprintModel(
      {
        ...resolveProvider(settings, env),
        systemPrompt: 'Reply with exactly this JSON object and nothing else: {"ok": true}',
        userPrompt: "Return the JSON object now.",
      },
      env,
    );
    return { success: true, latencyMs: Date.now() - startTime, model: settings.modelName || "default" };
  } catch (error: any) {
    return { success: false, error: error?.message || "Connection test failed." };
  }
}

// Asks the configured model to write a test file for one part of the compiled blueprint.
export async function generateBlueprintTests(
  input: { targetSpec?: string; testFramework?: string; blueprint: unknown } & ProviderSettings,
  env: LlmEnv,
) {
  const specName = input.targetSpec || "core capability";
  const framework = input.testFramework === "vitest" ? "vitest" : "jest";
  const systemPrompt = `You write unit test files in TypeScript using ${framework}.
Write tests for the "${specName}" part of the software blueprint the user provides, based only on the capabilities, interfaces and files described in it.
The implementation does not exist yet, so write the tests against the interfaces the blueprint describes and mark any assumed module paths with a comment.
Output only the TypeScript test file: start with the imports, no explanation and no markdown fences.`;
  const userPrompt = `Target: ${specName}\n\nBlueprint (JSON):\n${JSON.stringify(input.blueprint, null, 2)}`;

  let code = await callBlueprintModel(
    { ...resolveProvider(input, env), systemPrompt, userPrompt, responseFormat: "text" },
    env,
  );
  if (code.includes("```")) {
    code = code.replace(/```(typescript|ts|javascript|js)?/gi, "").trim();
  }
  if (!code.trim()) {
    throw new Error("The model returned an empty response.");
  }
  return { success: true, specName, framework, code, source: "llm" };
}
