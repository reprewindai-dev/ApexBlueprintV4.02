import { describe, it } from "node:test";
import assert from "node:assert";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { buildPlanPrompts, extractJson, normalizePlan, parsePlanText, SYSTEM_PROMPT, type PlanRecord } from "../plan/plan";
import { planToAgentBrief, planToMarkdown, fileSlug } from "../plan/export";
import { handleGenerate, handleCheckModel } from "../plan/http";
import { friendlyError } from "../plan/errors";

const SAMPLE = {
  title: "Pack Tracker",
  oneLiner: "Session packs and bookings for personal trainers.",
  summary: { problem: "Clients ghost.", solution: "Bookings plus renewal nudges.", audience: "Independent trainers" },
  users: [{ name: "Trainer", goal: "keep clients", pain: "spreadsheets" }],
  features: [
    { name: "Booking", description: "Clients book slots", priority: "MUST", acceptanceCriteria: ["Client books in under 3 taps"] },
    { name: "Group classes", description: "Later", priority: "later", acceptanceCriteria: [] },
    { name: "Weird", description: "x", priority: "urgent", acceptanceCriteria: "not a list" },
  ],
  userFlows: [{ name: "Book", steps: ["Open link", "Pick slot"] }, { name: "Empty", steps: [] }],
  architecture: { overview: "Next.js app", components: [{ name: "Web", responsibility: "UI", tech: "Next.js" }], integrations: [{ name: "Stripe", purpose: "payments" }] },
  dataModel: [{ entity: "Client", fields: ["id: uuid", 42], notes: "" }],
  api: [{ method: "post", path: "/bookings", purpose: "create" }],
  milestones: [{ name: "Bookable MVP", goal: "Trainers take bookings", deliverables: ["Booking page"], estimate: "2-3 weeks" }],
  risks: [{ risk: "No-shows", impact: "HIGH", mitigation: "Reminders" }],
  business: { pricing: "Proposal: $19/mo", goToMarket: "Local gyms", successMetrics: ["10 trainers"] },
  assumptions: ["Stripe for payments"],
  openQuestions: [{ question: "SMS or WhatsApp?", whyItMatters: "Cost and setup differ" }],
};

const record = (): PlanRecord => ({ id: "x", createdAt: "2026-10-12T00:00:00Z", notes: "n", model: "m", ...normalizePlan(SAMPLE) });

describe("plan parsing", () => {
  it("normalizes types, priorities and impact levels without inventing content", () => {
    const { plan, missing } = normalizePlan(SAMPLE);
    assert.deepStrictEqual(plan.features.map((f) => f.priority), ["must", "later", "should"]);
    assert.deepStrictEqual(plan.features[2].acceptanceCriteria, []);
    assert.strictEqual(plan.userFlows.length, 1, "flows without steps are dropped");
    assert.deepStrictEqual(plan.dataModel[0].fields, ["id: uuid", "42"]);
    assert.strictEqual(plan.api[0].method, "POST");
    assert.strictEqual(plan.risks[0].impact, "high");
    assert.deepStrictEqual(missing, []);
  });

  it("reports missing sections instead of filling them", () => {
    const { plan, missing } = normalizePlan({ title: "Only a title" });
    assert.strictEqual(plan.features.length, 0);
    assert.ok(missing.includes("Features") && missing.includes("Open questions") && !missing.includes("Title"));
  });

  it("reads JSON wrapped in prose or code fences", () => {
    assert.deepStrictEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
    assert.deepStrictEqual(extractJson('Here you go: {"a":2} hope that helps'), { a: 2 });
    assert.throws(() => extractJson("no json here"), /readable plan/);
  });

  it("rejects a reply with no plan in it", () => {
    assert.throws(() => parsePlanText('{"hello": "world"}'), /did not contain a plan/);
  });
});

describe("prompts", () => {
  it("includes the notes and optional context, and forbids invented facts", () => {
    const { systemPrompt, userPrompt } = buildPlanPrompts({ notes: "  my idea  ", projectType: "Mobile app", codebaseContext: "Files: a.ts" });
    assert.strictEqual(systemPrompt, SYSTEM_PROMPT);
    assert.match(userPrompt, /Notes:\nmy idea/);
    assert.match(userPrompt, /Mobile app/);
    assert.match(userPrompt, /Existing code/);
    assert.match(systemPrompt, /Never invent facts/);
    assert.doesNotMatch(systemPrompt, /x402|einstein|jurisdiction/i);
  });
});

describe("exports", () => {
  it("writes a readable Markdown plan", () => {
    const md = planToMarkdown(record());
    for (const heading of ["# Pack Tracker", "## Open questions", "## Features", "### Must have", "## Build plan", "## Assumptions"]) {
      assert.ok(md.includes(heading), `missing ${heading}`);
    }
    assert.match(md, /- \[ \] Client books in under 3 taps/);
  });

  it("briefs a coding agent on milestone 1 and the must-haves", () => {
    const brief = planToAgentBrief(record());
    assert.match(brief, /Build milestone 1, "Bookable MVP"/);
    assert.match(brief, /### Booking/);
    assert.doesNotMatch(brief.split("Full plan for reference")[0], /Group classes/);
    assert.match(brief, /SMS or WhatsApp\?/);
    assert.strictEqual(fileSlug(record().plan), "pack-tracker");
  });
});

describe("HTTP handlers", () => {
  it("validates input before calling any model", async () => {
    assert.strictEqual((await handleGenerate({ notes: "  " }, {})).status, 400);
    assert.strictEqual((await handleGenerate({ notes: "x".repeat(60_001) }, {})).status, 413);
    const noProvider = await handleGenerate({ notes: "idea", model: {} }, {});
    assert.strictEqual(noProvider.status, 400);
    assert.match((noProvider.body as { error: string }).error, /Choose a model provider/);
  });

  it("generates a plan from a streaming OpenAI-compatible model", async () => {
    const reply = JSON.stringify(SAMPLE);
    let seen: any = null;
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        seen = JSON.parse(body);
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        // Split mid-token to exercise the stream reassembly.
        for (const part of [reply.slice(0, 37), reply.slice(37, 400), reply.slice(400)]) {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: part } }] })}\n\n`);
        }
        res.end("data: [DONE]\n\n");
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
    try {
      const result = await handleGenerate(
        { notes: "trainer app idea", model: { selectedProvider: "custom", customUrl: url, modelName: "test-model", authMode: "none" } },
        {},
      );
      assert.strictEqual(result.status, 200, JSON.stringify(result.body));
      const rec = result.body as PlanRecord;
      assert.strictEqual(rec.plan.title, "Pack Tracker");
      assert.strictEqual(rec.model, "test-model");
      assert.strictEqual(rec.notes, "trainer app idea");
      assert.strictEqual(seen.stream, true);
      assert.strictEqual(seen.model, "test-model");
      assert.match(seen.messages[1].content, /trainer app idea/);

      const check = await handleCheckModel({ model: { selectedProvider: "custom", customUrl: url, modelName: "test-model" } }, {});
      assert.deepStrictEqual(check.body, { ok: true });
    } finally {
      server.close();
    }
  });
});

describe("provider errors", () => {
  it("explains common provider failures and passes unknown ones through", () => {
    assert.match(friendlyError('Anthropic API failed: {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}'), /rejected your API key/);
    assert.match(friendlyError("OPENAI API failed: You exceeded your current quota"), /out of credit/);
    assert.match(friendlyError('OLLAMA API failed: {"error":"model \'llama9\' not found"}'), /model name was not found/);
    assert.strictEqual(friendlyError("something new"), "something new");
  });
});
