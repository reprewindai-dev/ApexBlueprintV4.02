// Cloudflare Pages Function: POST /api/generate
//
// The production site is served by Cloudflare Pages, which does not run server.ts.
// This function runs the same blueprint generation core as the Express server so the
// compile button works on the hosted site. It uses the provider key the user enters in
// "LLM Engine", or a key configured as a Pages environment variable (e.g. GEMINI_API_KEY).
//
// Not done here (Node-only in server.ts): the durable job queue, the compilation cache,
// and the HMAC-signed SEKED triage. Their fields are simply absent from the response.
import { buildBlueprintPrompts, callBlueprintModel, parseBlueprintText } from "../../src/server/blueprint-core";
import { calculateBlueprintHash } from "../../src/core/plan-ir";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const onRequestPost = async (context: { request: Request; env: Record<string, string | undefined> }) => {
  let data: any;
  try {
    data = await context.request.json();
  } catch {
    return json({ error: "Request body must be JSON." }, 400);
  }

  const {
    notes,
    codebaseContext,
    audioTranscript,
    targetPlatform,
    userEmail,
    provider,
    apiKey,
    modelName,
    customUrl,
    selectedJurisdiction,
    constitutionVersion,
    constitutionState,
    authMode,
    customHeaderName,
  } = data || {};

  if (!notes) {
    return json({ error: "Missing required field: notes" }, 400);
  }

  const startTime = Date.now();
  try {
    const { systemPrompt, userPrompt } = buildBlueprintPrompts({
      notes,
      codebaseContext,
      audioTranscript,
      targetPlatform,
      emailToUse: userEmail || "anonymous@apex.local",
      constVersion: constitutionVersion || "v4.02.1",
      constState: constitutionState || "LOCKED",
      jurisdictionProfileName: selectedJurisdiction || "global",
    });

    const selectedProvider = provider || context.env.ABIDE_DEFAULT_PROVIDER || "gemini";
    const textResult = await callBlueprintModel(
      { selectedProvider, apiKey, modelName, customUrl, authMode, customHeaderName, systemPrompt, userPrompt },
      context.env,
    );

    const parsedData = parseBlueprintText(textResult);
    parsedData.hash = calculateBlueprintHash(parsedData);
    parsedData.timestamp = new Date().toISOString();
    parsedData.cacheStatus = { hit: false, key: "", type: "NONE", latencyMs: Date.now() - startTime };
    return json(parsedData);
  } catch (error: any) {
    return json({ error: error?.message || String(error) }, 500);
  }
};
