import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { compileSekedDirective, normalizeTelemetry } from "../compiler/seked";
import { checkVeklomHealth } from "../veklom-client";
import { executeCapabilityStep, isExecutionAdapterConfigured, isPglAdapterConfigured, sealStepOnLedger } from "./execution";
import { PlanIR, PlanStep, validatePlanIR } from "./plan-ir";
import { CanonicalBlueprintV1Schema, PlanIRSchema } from "./validation";
import { calculateBlueprintHash } from "./plan-ir";

export const APEX_SPECIALIST_ID = "apex-trust-spine-specialist";

export type ApexTaskKind =
  | "blueprint.validate"
  | "seked.compile"
  | "veklom.health"
  | "capability.execute";

export type ApexTaskStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface ApexTaskRecord {
  id: string;
  kind: ApexTaskKind;
  payload: Record<string, unknown>;
  status: ApexTaskStatus;
  attempts: number;
  maxAttempts: number;
  workerId: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  heartbeatAt?: string;
  result?: unknown;
  error?: string;
}

export interface ApexWorkerSnapshot {
  workerId: string;
  running: boolean;
  activeTaskId: string | null;
  queueDepth: number;
  totals: Record<ApexTaskStatus, number>;
  lastHeartbeatAt: string | null;
}

type PersistedEvent =
  | { type: "upsert"; task: ApexTaskRecord }
  | { type: "delete"; taskId: string };

const TERMINAL_STATUSES = new Set<ApexTaskStatus>(["succeeded", "failed", "cancelled"]);

function isoNow(): string {
  return new Date().toISOString();
}

function taskId(): string {
  return `apex-task-${crypto.randomUUID()}`;
}

function boundedAttempts(value: unknown): number {
  const attempts = Number(value ?? 3);
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10) {
    throw new Error("maxAttempts must be an integer between 1 and 10.");
  }
  return attempts;
}

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function finiteMetric(payload: Record<string, unknown>, key: string): number {
  const value = Number(payload[key]);
  if (!Number.isFinite(value)) throw new Error(`${key} must be a finite number.`);
  return value;
}

async function runTask(task: ApexTaskRecord): Promise<unknown> {
  switch (task.kind) {
    case "blueprint.validate": {
      const blueprint = asRecord(task.payload.blueprint, "blueprint");
      const parsed = CanonicalBlueprintV1Schema.safeParse(blueprint);
      if (!parsed.success) {
        throw new Error(`Blueprint validation failed: ${parsed.error.issues.map((issue) => issue.path.join(".") + " " + issue.message).join("; ")}`);
      }
      const calculatedHash = calculateBlueprintHash(blueprint);
      const suppliedHash = typeof blueprint.hash === "string" ? blueprint.hash : "";
      if (suppliedHash !== calculatedHash) {
        throw new Error(`Blueprint hash mismatch: expected ${calculatedHash}, received ${suppliedHash || "<missing>"}.`);
      }
      return { valid: true, blueprintHash: calculatedHash, packetCount: Array.isArray(blueprint.agentPackets) ? blueprint.agentPackets.length : 0 };
    }
    case "seked.compile": {
      const metrics = {
        latencyMs: finiteMetric(task.payload, "e"),
        reputationScale: finiteMetric(task.payload, "r"),
        unapprovedDrifts: finiteMetric(task.payload, "c"),
        nonCompliantRegions: finiteMetric(task.payload, "d"),
        settlementDelaySec: finiteMetric(task.payload, "s"),
      };
      const normalized = normalizeTelemetry(metrics);
      return { normalized, directive: compileSekedDirective(normalized) };
    }
    case "veklom.health":
      return checkVeklomHealth({
        baseUrl: typeof task.payload.baseUrl === "string" ? task.payload.baseUrl : undefined,
        timeoutMs: typeof task.payload.timeoutMs === "number" ? task.payload.timeoutMs : undefined,
      });
    case "capability.execute": {
      if (!isExecutionAdapterConfigured() || !isPglAdapterConfigured()) {
        throw new Error("APEX_EXECUTION_ADAPTERS_NOT_CONFIGURED: capability execution requires CAPABILITY_EXECUTORS_CONFIGURED=true and PGL_ADAPTER_CONFIGURED=true.");
      }
      const parsed = PlanIRSchema.safeParse(task.payload.plan);
      if (!parsed.success) throw new Error(`PlanIR validation failed: ${parsed.error.issues.map((issue) => issue.path.join(".") + " " + issue.message).join("; ")}`);
      const plan = parsed.data as PlanIR;
      const validation = validatePlanIR(plan);
      if (!validation.valid) throw new Error(`PlanIR trust-spine validation failed: ${validation.errors.join("; ")}`);
      if (plan.status !== "APPROVED") throw new Error(`Plan ${plan.planId} is ${plan.status}; only APPROVED plans may execute.`);
      const requestedStepId = typeof task.payload.stepId === "string" ? task.payload.stepId : undefined;
      const steps = requestedStepId ? plan.steps.filter((step) => step.stepId === requestedStepId) : plan.steps;
      if (!steps.length) throw new Error("Requested plan step was not found.");
      if (steps.some((step) => step.lane === 3 && !step.approvalToken)) throw new Error("Lane 3 execution requires an approval token on every external step.");
      const results = steps.map((step: PlanStep) => {
        const result = executeCapabilityStep(step);
        return { result, receipt: sealStepOnLedger(plan.planId, result) };
      });
      return { planId: plan.planId, results };
    }
  }
}

export class ApexWorkerRuntime {
  private readonly tasks = new Map<string, ApexTaskRecord>();
  private readonly statePath: string;
  private readonly pollMs: number;
  private readonly leaseMs: number;
  private timer: NodeJS.Timeout | null = null;
  private processing = false;
  private activeTaskId: string | null = null;
  private lastHeartbeatAt: string | null = null;
  private loaded = false;

  constructor(options: { statePath?: string; pollMs?: number; leaseMs?: number } = {}) {
    this.statePath = options.statePath || process.env.APEX_WORKER_STATE_PATH || path.join(process.cwd(), ".apex-worker", "events.jsonl");
    this.pollMs = options.pollMs ?? 500;
    this.leaseMs = options.leaseMs ?? 120_000;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const contents = await fs.readFile(this.statePath, "utf8");
      for (const line of contents.split("\n").filter(Boolean)) {
        const event = JSON.parse(line) as PersistedEvent;
        if (event.type === "upsert") this.tasks.set(event.task.id, event.task);
        if (event.type === "delete") this.tasks.delete(event.taskId);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  async start(): Promise<void> {
    await this.load();
    if (this.timer) return;
    this.timer = setInterval(() => { void this.tick(); }, this.pollMs);
    this.timer.unref?.();
    await this.tick();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.activeTaskId = null;
  }

  async enqueue(kind: ApexTaskKind, payload: Record<string, unknown>, maxAttempts?: unknown): Promise<ApexTaskRecord> {
    await this.load();
    const now = isoNow();
    const task: ApexTaskRecord = {
      id: taskId(), kind, payload, status: "queued", attempts: 0,
      maxAttempts: boundedAttempts(maxAttempts), workerId: APEX_SPECIALIST_ID,
      createdAt: now, updatedAt: now, heartbeatAt: now,
    };
    this.tasks.set(task.id, task);
    await this.persist({ type: "upsert", task });
    await this.tick();
    return task;
  }

  async cancel(id: string): Promise<ApexTaskRecord | null> {
    await this.load();
    const task = this.tasks.get(id);
    if (!task || TERMINAL_STATUSES.has(task.status)) return task || null;
    task.status = "cancelled";
    task.updatedAt = isoNow();
    task.finishedAt = task.updatedAt;
    await this.persist({ type: "upsert", task });
    return task;
  }

  async get(id: string): Promise<ApexTaskRecord | null> {
    await this.load();
    return this.tasks.get(id) || null;
  }

  async snapshot(): Promise<ApexWorkerSnapshot> {
    await this.load();
    const totals: Record<ApexTaskStatus, number> = { queued: 0, running: 0, succeeded: 0, failed: 0, cancelled: 0 };
    for (const task of this.tasks.values()) totals[task.status]++;
    return { workerId: APEX_SPECIALIST_ID, running: Boolean(this.timer), activeTaskId: this.activeTaskId, queueDepth: totals.queued, totals, lastHeartbeatAt: this.lastHeartbeatAt };
  }

  private async tick(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      await this.load();
      const now = Date.now();
      const stale = [...this.tasks.values()].find((task) => task.status === "running" && task.startedAt && now - Date.parse(task.heartbeatAt || task.startedAt) > this.leaseMs);
      if (stale) {
        if (stale.attempts < stale.maxAttempts) {
          stale.status = "queued";
          stale.updatedAt = isoNow();
          stale.error = "Worker lease expired; task requeued.";
          await this.persist({ type: "upsert", task: stale });
        } else {
          stale.status = "failed";
          stale.updatedAt = isoNow();
          stale.finishedAt = stale.updatedAt;
          stale.error = "Worker lease expired after maximum attempts.";
          await this.persist({ type: "upsert", task: stale });
        }
      }
      const next = [...this.tasks.values()].find((task) => task.status === "queued");
      this.lastHeartbeatAt = isoNow();
      if (!next) return;
      this.activeTaskId = next.id;
      next.status = "running";
      next.attempts += 1;
      next.startedAt = next.startedAt || isoNow();
      next.heartbeatAt = isoNow();
      next.updatedAt = next.heartbeatAt;
      await this.persist({ type: "upsert", task: next });
      try {
        next.result = await runTask(next);
        next.status = "succeeded";
      } catch (error) {
        next.error = error instanceof Error ? error.message : String(error);
        next.status = next.attempts < next.maxAttempts ? "queued" : "failed";
      }
      next.updatedAt = isoNow();
      next.heartbeatAt = next.updatedAt;
      if (TERMINAL_STATUSES.has(next.status)) next.finishedAt = next.updatedAt;
      await this.persist({ type: "upsert", task: next });
      this.activeTaskId = null;
    } finally {
      this.processing = false;
    }
  }

  private async persist(event: PersistedEvent): Promise<void> {
    await fs.mkdir(path.dirname(this.statePath), { recursive: true });
    await fs.appendFile(this.statePath, `${JSON.stringify(event)}\n`, "utf8");
  }
}
