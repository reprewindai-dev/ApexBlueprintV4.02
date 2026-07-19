import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ApexWorkerRuntime } from "../core/apex-worker";

describe("Apex Trust-Spine Specialist worker", () => {
  it("executes and persists a SEKED task", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "apex-worker-"));
    const statePath = path.join(directory, "events.jsonl");
    const worker = new ApexWorkerRuntime({ statePath, pollMs: 10 });
    const task = await worker.enqueue("seked.compile", { e: 120, r: 0.9, c: 0, d: 0, s: 1 });
    const completed = await worker.get(task.id);

    assert.equal(completed?.status, "succeeded");
    assert.equal((completed?.result as { directive?: { directive?: string } }).directive?.directive, "SOVEREIGN_EXECUTION");

    const reloaded = new ApexWorkerRuntime({ statePath });
    assert.equal((await reloaded.get(task.id))?.status, "succeeded");
    await worker.stop();
    await reloaded.stop();
    await fs.rm(directory, { recursive: true, force: true });
  });

  it("fails closed when a blueprint hash is invalid", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "apex-worker-"));
    const worker = new ApexWorkerRuntime({ statePath: path.join(directory, "events.jsonl") });
    const task = await worker.enqueue("blueprint.validate", { blueprint: { title: "tampered", hash: "bad" } }, 1);
    const completed = await worker.get(task.id);

    assert.equal(completed?.status, "failed");
    assert.match(completed?.error || "", /Blueprint validation failed/);
    await worker.stop();
    await fs.rm(directory, { recursive: true, force: true });
  });
});

