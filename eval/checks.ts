// Checks that need no model: is everything from the notes in the plan, is anything
// forbidden in it, and does each section meet the depth the prompt asks for.
import type { Plan } from "../src/plan/plan";
import { ALWAYS_FORBIDDEN, type EvalCase } from "./cases";

export interface CheckResult {
  passed: boolean;
  grounding: { hit: number; total: number; missed: string[] };
  questions: { hit: number; total: number; missed: string[] };
  forbidden: string[];
  depth: string[];
}

function flatten(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flatten).join("\n");
  if (value && typeof value === "object") return Object.values(value).map(flatten).join("\n");
  return value == null ? "" : String(value);
}

function groups(haystack: string, wanted: string[][]) {
  const text = haystack.toLowerCase();
  const missed = wanted.filter((g) => !g.some((w) => text.includes(w.toLowerCase()))).map((g) => g.join(" / "));
  return { hit: wanted.length - missed.length, total: wanted.length, missed };
}

export function checkPlan(c: EvalCase, plan: Plan, missingSections: string[]): CheckResult {
  const all = flatten(plan);
  const grounding = groups(all, c.mustMention);
  const questions = groups(flatten(plan.openQuestions), c.mustAsk);

  const forbidden = [
    ...ALWAYS_FORBIDDEN.filter((f) => f.pattern.test(all) && !f.pattern.test(c.notes)).map((f) => f.label),
    ...(c.mustNotMention ?? []).filter((w) => all.toLowerCase().includes(w.toLowerCase())).map((w) => `"${w}"`),
  ];

  // The minimums the prompt sets. A plan below them is thin, not wrong, so these are
  // reported but only missing sections fail a plan outright.
  const depth: string[] = [];
  const must = plan.features.filter((f) => f.priority === "must");
  const want = (ok: boolean, msg: string) => !ok && depth.push(msg);
  want(plan.features.length >= 6, `${plan.features.length} features (want 6-14)`);
  want(must.length >= 4, `${must.length} must-have features (want 4-7)`);
  want(plan.features.every((f) => f.acceptanceCriteria.length >= 2), "a feature has fewer than 2 acceptance criteria");
  want(plan.milestones.length >= 3, `${plan.milestones.length} milestones (want 3-5)`);
  want(plan.risks.length >= 3, `${plan.risks.length} risks (want 3-6)`);
  want(plan.openQuestions.length >= 3, `${plan.openQuestions.length} open questions (want 3-6)`);
  want(plan.architecture.components.every((x) => x.tech), "a component has no technology named");
  want(plan.dataModel.length >= 2, `${plan.dataModel.length} data entities`);
  want(plan.userFlows.every((f) => f.steps.length >= 4), "a user flow has fewer than 4 steps");

  return {
    passed: missingSections.length === 0 && forbidden.length === 0 && grounding.missed.length === 0 && questions.missed.length === 0,
    grounding,
    questions,
    forbidden,
    depth: [...missingSections.map((s) => `missing section: ${s}`), ...depth],
  };
}
