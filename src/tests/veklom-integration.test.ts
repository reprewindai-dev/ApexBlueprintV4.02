import { describe, it } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { CanonicalBlueprintV1Schema } from "../core/validation";

process.env.NODE_ENV = "test";
const { app } = await import("../../server");

const RUN_LIVE_VEKLOM_TESTS = process.env.RUN_LIVE_VEKLOM_TESTS === "true" && !!process.env.VEKLOM_API_KEY;
const liveIt = RUN_LIVE_VEKLOM_TESTS ? it : it.skip;

describe("Milestone 2: Veklom Adapter & Live Integration Tests", () => {
  const LIVE_API_BASE = "https://api.veklom.com";

  liveIt("1. Live API /api/v1/health must respond with healthy status and fresh timestamp", async () => {
    const res = await fetch(`${LIVE_API_BASE}/api/v1/health`);
    assert.strictEqual(res.status, 200, "Health endpoint should return HTTP 200");

    const data = await res.json();
    assert.strictEqual(data.status, "healthy", "Status must be 'healthy'");
    assert.strictEqual(data.service, "Veklom Sovereign AI Hub", "Service identifier must match");
    assert.ok(data.timestamp, "Timestamp must be present");

    const serverTime = new Date(data.timestamp).getTime();
    const localTime = Date.now();
    const timeDifferenceMs = Math.abs(localTime - serverTime);

    assert.ok(
      timeDifferenceMs < 5 * 60 * 1000,
      `Timestamp is stale. Difference: ${timeDifferenceMs / 1000}s. Server time: ${data.timestamp}, Local time: ${new Date().toISOString()}`
    );
  });

  liveIt("2. Live v1/exec must reject invalid credentials with authentication failure", async () => {
    const res = await fetch(`${LIVE_API_BASE}/v1/exec`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "byos_invalid_key_for_testing_purposes",
      },
      body: JSON.stringify({
        prompt: "Generate standard blueprint",
        model: "qwen2.5:3b",
        use_memory: false,
        max_tokens: 100,
        temperature: 0.2,
      }),
    });

    assert.ok(
      res.status === 401 || res.status === 403,
      `Expected HTTP 401 or 403 for invalid credentials, but got HTTP ${res.status}`
    );
  });

  it("3. Execution path validation returns a fallback blueprint when live mode is disabled", async () => {
    const serverInstance = http.createServer(app);
    await new Promise<void>((resolve) => serverInstance.listen(0, resolve));
    const address = serverInstance.address() as any;
    const localPort = address.port;

    try {
      const res = await fetch(`http://localhost:${localPort}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notes: "Build a secure sovereign payment processing edge node.",
          provider: "veklom",
          modelName: "qwen2.5:3b",
        }),
      });

      assert.strictEqual(res.status, 200, "Should fall back gracefully and return HTTP 200");
      const data = await res.json();
      assert.strictEqual(data.source, "fallback", "Blueprint source should be 'fallback'");
      assert.strictEqual(data.quota_fallback, true, "quota_fallback must be set to true");
    } finally {
      serverInstance.close();
    }
  });

  if (RUN_LIVE_VEKLOM_TESTS) {
    it("4. Execution path validation with a configured API key returns a schema-valid blueprint", async () => {
      const apiKey = process.env.VEKLOM_API_KEY;
      assert.ok(apiKey, "VEKLOM_API_KEY must be set when RUN_LIVE_VEKLOM_TESTS=true");

      const serverInstance = http.createServer(app);
      await new Promise<void>((resolve) => serverInstance.listen(0, resolve));
      const address = serverInstance.address() as any;
      const localPort = address.port;

      try {
        const res = await fetch(`http://localhost:${localPort}/api/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            notes: "Build a micro-transaction edge payment pipeline.",
            provider: "veklom",
            modelName: "qwen2.5:3b",
            apiKey: apiKey,
          }),
        });

        assert.strictEqual(res.status, 200, "Live API generate request should succeed");
        const data = await res.json();

        assert.ok(data.title, "Returned blueprint must have a title");
        assert.ok(data.tagline, "Returned blueprint must have a tagline");
        assert.ok(data.hash, "Returned blueprint must have a hash");

        const rawText = JSON.stringify(data);
        assert.ok(
          !rawText.includes("[Orchestrated Execution] Processed via ExecutionIdentityV1"),
          "Live response must contain real model-generated content, not the orchestrator placeholder"
        );

        const parseResult = CanonicalBlueprintV1Schema.safeParse(data);
        assert.ok(
          parseResult.success,
          `Returned blueprint failed schema validation: ${parseResult.success ? "" : JSON.stringify(parseResult.error.format())}`
        );
      } finally {
        serverInstance.close();
      }
    });
  }
});
