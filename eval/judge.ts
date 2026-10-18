// A second model reads the notes and the plan and grades the plan: does every point in
// the notes land in the plan, and does the plan state anything as fact that the notes
// do not support. Uses the same provider layer as Apex.
import { callBlueprintModel, type LlmEnv } from "../src/server/blueprint-core";
import { extractJson, type Plan, type TokenUsage } from "../src/plan/plan";

export interface Judgement {
  notePoints: { point: string; whereInPlan: string; covered: boolean }[];
  unsupportedClaims: { claim: string; why: string }[];
  scores: { grounding: number; coverage: number; specificity: number; openQuestions: number; consistency: number };
  biggestProblem: string;
  verdict: "ready" | "needs work";
}

const score = { type: "integer", enum: [1, 2, 3, 4, 5] };
const text = { type: "string" };
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const JUDGE_SCHEMA = obj({
  notePoints: { type: "array", items: obj({ point: text, whereInPlan: text, covered: { type: "boolean" } }) },
  unsupportedClaims: { type: "array", items: obj({ claim: text, why: text }) },
  scores: obj({ grounding: score, coverage: score, specificity: score, openQuestions: score, consistency: score }),
  biggestProblem: text,
  verdict: { type: "string", enum: ["ready", "needs work"] },
});

const SYSTEM = `You review build plans that were written from a founder's notes. Be strict and literal.

1. notePoints: split the notes into every distinct point (each feature, number, constraint,
   deadline, worry, open idea). For each, say where it appears in the plan (section and item) or
   "nowhere", and whether it is covered. A point the notes leave undecided is covered only if
   the plan treats it as undecided (an open question, or an assumption labelled as such).
2. unsupportedClaims: statements the plan presents as fact that the notes do not support:
   statistics, market sizes, customer names, quotes, research, competitor facts, or numbers
   that are not in the notes and are not labelled as a proposal, estimate or assumption.
   Technology choices, proposals and labelled assumptions are allowed and are not claims.
3. scores, 1 (poor) to 5 (excellent):
   - grounding: uses the notes' own words, names and numbers; invents nothing.
   - coverage: every point in the notes is in the plan.
   - specificity: features, acceptance criteria, flows and architecture are concrete enough
     for a developer to start building; no filler.
   - openQuestions: the open questions are the real decisions the notes leave open, most
     important first.
   - consistency: milestones, must-have features, data model and API fit together.
4. biggestProblem: the one change that would most improve this plan, or "none".
5. verdict: "ready" only if a small team could start building from this plan as written.

Reply with JSON only.`;

export async function judgePlan(
  notes: string,
  plan: Plan,
  env: LlmEnv,
  model = "claude-opus-5-5",
): Promise<{ judgement: Judgement; usage?: TokenUsage }> {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("The judge needs ANTHROPIC_API_KEY.");
  let usage: TokenUsage | undefined;
  const reply = await callBlueprintModel(
    {
      selectedProvider: "anthropic",
      apiKey,
      modelName: model,
      systemPrompt: SYSTEM,
      userPrompt: `Notes:\n${notes}\n\nPlan (JSON):\n${JSON.stringify(plan, null, 2)}`,
      responseFormat: "json",
      jsonSchema: JUDGE_SCHEMA,
      onUsage: (u) => (usage = u),
    },
    env,
  );
  return { judgement: extractJson(reply) as Judgement, usage };
}
