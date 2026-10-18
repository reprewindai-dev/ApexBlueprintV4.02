// Runs every case through Apex's real plan generator, checks each plan, optionally has
// Claude grade it, and writes the plans plus a report to eval/results/.
//
//   npx tsx eval/run.ts --provider anthropic --model claude-opus-5-5 --judge
//   npx tsx eval/run.ts --provider ollama --model qwen2.5:14b --cases trainer,ramble
//
// Options: --provider, --model, --url (Ollama or custom server), --cases a,b, --repeat N,
// --concurrency N, --judge, --judge-model. Keys come from the environment
// (ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generatePlan, modelLabel, type ModelChoice } from "../src/plan/generate";
import { planToMarkdown } from "../src/plan/export";
import type { PlanRecord, TokenUsage } from "../src/plan/plan";
import { CASES, type EvalCase } from "./cases";
import { checkPlan, type CheckResult } from "./checks";
import { judgePlan, type Judgement } from "./judge";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string, fallback = "") => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};

const provider = option("provider", "anthropic");
const KEYS: Record<string, string | undefined> = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  gemini: process.env.GEMINI_API_KEY,
  deepseek: process.env.DEEPSEEK_API_KEY,
};
const choice: ModelChoice = {
  selectedProvider: provider,
  apiKey: KEYS[provider],
  modelName: option("model") || undefined,
  customUrl: option("url") || undefined,
  authMode: provider === "ollama" ? "none" : "bearer",
};
const wanted = option("cases").split(",").filter(Boolean);
const cases = wanted.length ? CASES.filter((c) => wanted.includes(c.id)) : CASES;
const repeat = Math.max(1, Number(option("repeat", "1")));
const concurrency = Math.max(1, Number(option("concurrency", "3")));
const judge = flag("judge");
const judgeModel = option("judge-model", "claude-opus-5-5");

if (!cases.length) throw new Error(`No cases match ${wanted.join(",")}. Known: ${CASES.map((c) => c.id).join(", ")}`);
if (KEYS[provider] === undefined && provider in KEYS) throw new Error(`Set ${provider.toUpperCase()}_API_KEY first.`);

// Dollars per million tokens (input, output). Thinking is billed as output.
const PRICES: Record<string, [number, number]> = {
  "claude-fable-5-1": [10, 50],
  "claude-opus-5-5": [4, 20],
  "claude-opus-5": [5, 25],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};
const cost = (model: string, u?: TokenUsage) => {
  const p = PRICES[model];
  return p && u ? (u.inputTokens * p[0] + u.outputTokens * p[1]) / 1e6 : undefined;
};

interface Run {
  c: EvalCase;
  n: number;
  seconds: number;
  record?: PlanRecord;
  error?: string;
  checks?: CheckResult;
  judgement?: Judgement;
  judgeError?: string;
  cost?: number;
  judgeCost?: number;
}

const model = modelLabel(choice);
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = join("eval", "results", `${stamp}-${model.replace(/[^\w.-]+/g, "_")}`);
mkdirSync(outDir, { recursive: true });

async function runOne(c: EvalCase, n: number): Promise<Run> {
  const started = Date.now();
  const run: Run = { c, n, seconds: 0 };
  try {
    run.record = await generatePlan({ notes: c.notes, projectType: c.projectType }, choice, process.env);
    run.seconds = Math.round((Date.now() - started) / 1000);
    run.cost = cost(model, run.record.usage);
    run.checks = checkPlan(c, run.record.plan, run.record.missing);
    writeFileSync(join(outDir, `${c.id}-${n}.md`), planToMarkdown(run.record));
    if (judge) {
      try {
        const j = await judgePlan(c.notes, run.record.plan, process.env, judgeModel);
        run.judgement = j.judgement;
        run.judgeCost = cost(judgeModel, j.usage);
      } catch (err) {
        run.judgeError = (err as Error).message;
      }
    }
  } catch (err) {
    run.seconds = Math.round((Date.now() - started) / 1000);
    run.error = (err as Error).message;
  }
  const { c: _case, ...saved } = run;
  writeFileSync(join(outDir, `${c.id}-${n}.json`), JSON.stringify({ case: c.id, ...saved }, null, 2));
  const status = run.error ? `ERROR ${run.error.slice(0, 120)}` : run.checks?.passed ? "pass" : "FAIL";
  console.log(`${c.id}#${n}  ${run.seconds}s  ${status}${run.judgement ? `  judge: ${run.judgement.verdict}` : ""}`);
  return run;
}

const jobs = cases.flatMap((c) => Array.from({ length: repeat }, (_, i) => () => runOne(c, i + 1)));
const runs: Run[] = [];
console.log(`Apex eval: ${jobs.length} plans with ${model}${judge ? `, judged by ${judgeModel}` : ""} -> ${outDir}`);
await Promise.all(
  Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    for (let job = jobs.shift(); job; job = jobs.shift()) runs.push(await job());
  }),
);
runs.sort((a, b) => a.c.id.localeCompare(b.c.id) || a.n - b.n);

// Report
const money = (v?: number) => (v === undefined ? "n/a" : `$${v.toFixed(3)}`);
const sum = (vals: (number | undefined)[]) =>
  vals.some((v) => v !== undefined) ? vals.reduce<number>((t, v) => t + (v ?? 0), 0) : undefined;
const ok = runs.filter((r) => r.record);
const lines = [
  `# Apex eval: ${model}`,
  "",
  `${new Date().toISOString()} · ${runs.length} plans · ${ok.length} generated · ${runs.filter((r) => r.checks?.passed).length} passed every check` +
    (judge ? ` · ${runs.filter((r) => r.judgement?.verdict === "ready").length} judged ready` : ""),
  "",
  `Plan cost: ${money(sum(runs.map((r) => r.cost)))}` + (judge ? ` · judge cost: ${money(sum(runs.map((r) => r.judgeCost)))}` : "") +
    ` · median time: ${ok.length ? ok.map((r) => r.seconds).sort((a, b) => a - b)[Math.floor(ok.length / 2)] : 0}s`,
  "",
  "| Case | Time | Cost | Notes covered | Open questions | Forbidden | Depth | Judge (ground/cover/specific/questions/consistent) |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ...runs.map((r) => {
    if (!r.checks) return `| ${r.c.id}#${r.n} | ${r.seconds}s | | ERROR: ${r.error} | | | | |`;
    const k = r.checks;
    const s = r.judgement?.scores;
    return `| ${r.c.id}#${r.n} | ${r.seconds}s | ${money(r.cost)} | ${k.grounding.hit}/${k.grounding.total} | ${k.questions.hit}/${k.questions.total} | ${
      k.forbidden.join(", ") || "none"
    } | ${k.depth.length ? k.depth.length + " gaps" : "ok"} | ${
      s ? `${s.grounding}/${s.coverage}/${s.specificity}/${s.openQuestions}/${s.consistency} ${r.judgement!.verdict}` : r.judgeError ? "error" : ""
    } |`;
  }),
  "",
  "## Details",
  ...runs.flatMap((r) => {
    const out = ["", `### ${r.c.id}#${r.n}: ${r.c.label}`];
    if (r.error) return [...out, `Error: ${r.error}`];
    const k = r.checks!;
    out.push(`Title: ${r.record!.plan.title}`);
    if (k.grounding.missed.length) out.push(`Missing from plan: ${k.grounding.missed.join("; ")}`);
    if (k.questions.missed.length) out.push(`Not raised as an open question: ${k.questions.missed.join("; ")}`);
    if (k.forbidden.length) out.push(`Forbidden content: ${k.forbidden.join("; ")}`);
    if (k.depth.length) out.push(`Depth: ${k.depth.join("; ")}`);
    if (r.judgement) {
      const j = r.judgement;
      const uncovered = j.notePoints.filter((p) => !p.covered);
      out.push(`Judge: ${j.verdict}. Biggest problem: ${j.biggestProblem}`);
      out.push(`Judge found ${j.notePoints.length - uncovered.length}/${j.notePoints.length} note points covered.`);
      uncovered.forEach((p) => out.push(`- Not covered: ${p.point}`));
      j.unsupportedClaims.forEach((u) => out.push(`- Unsupported: ${u.claim} (${u.why})`));
    }
    if (r.judgeError) out.push(`Judge error: ${r.judgeError}`);
    return out;
  }),
];
writeFileSync(join(outDir, "report.md"), lines.join("\n") + "\n");
console.log(`\nReport: ${join(outDir, "report.md")}`);
