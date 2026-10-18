import { describe, it } from "node:test";
import assert from "node:assert";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { buildPlanPrompts, estimateTokens, extractJson, MAX_NOTES, normalizePlan, parsePlanText, SYSTEM_PROMPT, type PlanRecord } from "../plan/plan";
import { ollamaContextSize } from "../server/blueprint-core";
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
    assert.strictEqual((await handleGenerate({ notes: "x".repeat(MAX_NOTES + 1) }, {})).status, 413);
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

  it("asks Ollama for room for a full plan and holds the reply to the plan schema", async () => {
    const reply = JSON.stringify(SAMPLE);
    const fake = await fakeServer((body, res) => {
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      if (body.messages[1].content.includes("too long")) {
        res.end(JSON.stringify({ message: { content: reply.slice(0, 50) }, done: true, done_reason: "length" }) + "\n");
        return;
      }
      for (const part of [reply.slice(0, 41), reply.slice(41)]) res.write(JSON.stringify({ message: { content: part }, done: false }) + "\n");
      res.end(JSON.stringify({ message: { content: "" }, done: true, done_reason: "stop", prompt_eval_count: 1200, eval_count: 900 }) + "\n");
    });
    try {
      // In Docker, a localhost Ollama address from the browser goes to OLLAMA_LOCAL_URL.
      const result = await handleGenerate(
        { notes: "trainer app idea", model: { selectedProvider: "ollama", customUrl: "http://localhost:9/v1", modelName: "llama3.2" } },
        { OLLAMA_LOCAL_URL: `${fake.url}/v1` },
      );
      assert.strictEqual(result.status, 200, JSON.stringify(result.body));
      const rec = result.body as PlanRecord;
      assert.strictEqual(rec.plan.title, "Pack Tracker");
      assert.deepStrictEqual(rec.usage, { inputTokens: 1200, outputTokens: 900 });
      const seen = fake.requests[0];
      assert.strictEqual(seen.path, "/api/chat");
      // Apex sets the window itself (never leaves it to Ollama's own setting), sized to the prompt.
      const prompt = seen.body.messages.map((m: { content: string }) => m.content).join("");
      assert.strictEqual(seen.body.options.num_ctx, ollamaContextSize(estimateTokens(prompt)));
      assert.ok(seen.body.options.num_ctx <= 12288, `num_ctx ${seen.body.options.num_ctx}`);
      assert.deepStrictEqual(seen.body.format.required, Object.keys(SAMPLE));

      const cut = await handleGenerate({ notes: "too long", model: { selectedProvider: "ollama", customUrl: fake.url } }, {});
      assert.strictEqual(cut.status, 502);
      assert.match((cut.body as { error: string }).error, /cut off/);
    } finally {
      fake.close();
    }
  });

  it("asks Claude for a schema-bound plan with room to think, and reports a cut-off reply", async () => {
    const reply = JSON.stringify(SAMPLE);
    const sse = (event: unknown) => `data: ${JSON.stringify(event)}\n\n`;
    const fake = await fakeServer((body, res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write(sse({ type: "message_start", message: { usage: { input_tokens: 2100, output_tokens: 1 } } }));
      res.write(sse({ type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "" } }));
      for (const part of [reply.slice(0, 33), reply.slice(33)]) {
        res.write(sse({ type: "content_block_delta", index: 1, delta: { type: "text_delta", text: part } }));
      }
      const stop = body.messages[0].content.includes("too long") ? "max_tokens" : "end_turn";
      res.end(sse({ type: "message_delta", delta: { stop_reason: stop }, usage: { output_tokens: 7000 } }));
    });
    try {
      const model = { selectedProvider: "anthropic", apiKey: "test-key", customUrl: fake.url, modelName: "claude-opus-5-5" };
      const result = await handleGenerate({ notes: "trainer app idea", model }, {});
      assert.strictEqual(result.status, 200, JSON.stringify(result.body));
      const rec = result.body as PlanRecord;
      assert.strictEqual(rec.plan.title, "Pack Tracker");
      assert.deepStrictEqual(rec.usage, { inputTokens: 2100, outputTokens: 7000 });
      const seen = fake.requests[0];
      assert.strictEqual(seen.headers["x-api-key"], "test-key");
      assert.strictEqual(seen.body.max_tokens, 64000);
      assert.strictEqual(seen.body.output_config.effort, "high");
      assert.strictEqual(seen.body.output_config.format.type, "json_schema");
      assert.deepStrictEqual(seen.body.output_config.format.schema.required, Object.keys(SAMPLE));

      // Older Claude models do not take output_config.
      await handleGenerate({ notes: "x", model: { ...model, modelName: "claude-3-5-haiku-latest" } }, {});
      assert.strictEqual(fake.requests[1].body.output_config, undefined);

      const cut = await handleGenerate({ notes: "too long", model }, {});
      assert.strictEqual(cut.status, 502);
      assert.match((cut.body as { error: string }).error, /cut off/);
    } finally {
      fake.close();
    }
  });
});

// A local stand-in for a model server: records each request and lets the test answer it.
async function fakeServer(answer: (body: any, res: http.ServerResponse) => void) {
  const requests: { path: string; headers: http.IncomingHttpHeaders; body: any }[] = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw);
      requests.push({ path: req.url || "", headers: req.headers, body });
      answer(body, res);
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, requests, close: () => server.close() };
}

describe("Ollama context budget", () => {
  it("asks for enough room for the notes and refuses notes a local model cannot read", () => {
    assert.strictEqual(ollamaContextSize(0), 8192);
    assert.strictEqual(ollamaContextSize(1_900), 10240);
    assert.strictEqual(ollamaContextSize(12_000), 20480);
    assert.strictEqual(ollamaContextSize(24_000), 32768);
    assert.throws(() => ollamaContextSize(62_000), /too long for a model running on your computer/);
    // The limit quoted is room for the notes, after Apex's own instructions: notes just over it
    // are refused, and the message never quotes a limit the refused notes are under.
    const instructions = 1_269;
    const notesChars = 81_788;
    assert.throws(
      () => ollamaContextSize(instructions + Math.ceil(notesChars / 3.5), instructions),
      (err: Error) => {
        const quoted = Number(/about ([\d,]+) characters/.exec(err.message)![1].replace(/,/g, ""));
        return quoted < notesChars;
      },
    );
  });
});

describe("provider errors", () => {
  it("explains common provider failures and passes unknown ones through", () => {
    assert.match(
      friendlyError('OLLAMA API failed: {"error":{"message":"llama-server process has terminated: error loading model: unable to allocate CPU_REPACK buffer"}}'),
      /ran out of memory/,
    );
    assert.match(friendlyError('Anthropic API failed: {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}'), /rejected your API key/);
    assert.match(friendlyError("OPENAI API failed: You exceeded your current quota"), /out of credit/);
    assert.match(friendlyError('OLLAMA API failed: {"error":"model \'llama9\' not found"}'), /model name was not found/);
    assert.strictEqual(friendlyError("something new"), "something new");
  });
});
