// src/tests/security-hardening.test.ts
import assert from "node:assert";
import { describe, it } from "node:test";

// src/core/network.ts
import { isIP } from "node:net";
function isPrivateHostname(hostname) {
  const lower = hostname.trim().toLowerCase();
  if (!lower) return true;
  if (lower === "localhost" || lower.endsWith(".localhost") || lower.endsWith(".local")) return true;
  const ipVersion = isIP(lower);
  if (ipVersion === 4) {
    const [a, b] = lower.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || a === 169 && b === 254 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31;
  }
  if (ipVersion === 6) {
    return lower === "::" || lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:");
  }
  return false;
}
function validateHttpBaseUrl(input, options = {}) {
  const label = options.label || "URL";
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error(`${label} cannot be empty`);
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${label} must be a valid absolute http(s) URL`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label} must use http or https`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not embed credentials`);
  }
  if (parsed.search || parsed.hash) {
    throw new Error(`${label} must not include query parameters or fragments`);
  }
  if (!options.allowLocalNetworks && isPrivateHostname(parsed.hostname)) {
    throw new Error(`${label} cannot target localhost or private network hosts in this environment`);
  }
  const normalizedPath = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
  return `${parsed.origin}${normalizedPath}`.replace(/\/+$/, "");
}

// src/core/token.ts
import crypto3 from "crypto";

// src/core/plan-ir.ts
function stableStringify(val) {
  if (val === null) return "null";
  if (val === void 0) return "undefined";
  if (Array.isArray(val)) {
    return "[" + val.map((item) => stableStringify(item)).join(",") + "]";
  }
  if (typeof val === "object") {
    const keys = Object.keys(val).sort();
    return "{" + keys.map((k) => `${JSON.stringify(k)}:${stableStringify(val[k])}`).join(",") + "}";
  }
  return JSON.stringify(val);
}

// src/core/validation.ts
import { z } from "zod";
var GoalSchema = z.object({
  title: z.string(),
  description: z.string(),
  status: z.string()
});
var MoatSchema = z.object({
  capabilityName: z.string(),
  description: z.string(),
  advantageScore: z.number()
});
var EinsteinVariableSchema = z.object({
  name: z.string(),
  impact: z.string()
});
var EinsteinProbabilitySchema = z.object({
  modelName: z.string(),
  successRate: z.number(),
  latencyMs: z.number(),
  variables: z.array(EinsteinVariableSchema)
});
var AcademicPaperSchema = z.object({
  title: z.string(),
  author: z.string(),
  source: z.string(),
  summary: z.string(),
  relevance: z.string(),
  // Strict academic requirements added to avoid credibility risk
  resolvableIdentifier: z.string().url().optional(),
  retrievalTimestamp: z.string().optional(),
  quotedClaimLocation: z.string().optional(),
  verificationStatus: z.string().optional(),
  digitalSignature: z.string().optional()
});
var VirtualFileSchema = z.object({
  path: z.string(),
  content: z.string()
});
var DomainSchema = z.object({
  name: z.string(),
  description: z.string(),
  products: z.array(z.string())
});
var ProductSchema = z.object({
  name: z.string(),
  domain: z.string(),
  businessValue: z.string(),
  owner: z.string()
});
var CanonicalSystemSchema = z.object({
  name: z.string(),
  techStack: z.string(),
  purpose: z.string()
});
var RepositorySchema = z.object({
  name: z.string(),
  url: z.string().url(),
  capabilities: z.array(z.string()),
  status: z.string()
});
var OwnerSchema = z.object({
  name: z.string(),
  role: z.string(),
  team: z.string()
});
var RevenueStreamSchema = z.object({
  name: z.string(),
  description: z.string(),
  model: z.string()
});
var PolicySchema = z.object({
  name: z.string(),
  rule: z.string(),
  scope: z.string()
});
var ExternalProviderSchema = z.object({
  name: z.string(),
  service: z.string(),
  sla: z.string()
});
var CompanyGraphSchema = z.object({
  domains: z.array(DomainSchema),
  products: z.array(ProductSchema),
  canonicalSystems: z.array(CanonicalSystemSchema),
  repositories: z.array(RepositorySchema),
  environments: z.array(z.string()),
  owners: z.array(OwnerSchema),
  revenueStreams: z.array(RevenueStreamSchema),
  policies: z.array(PolicySchema),
  externalProviders: z.array(ExternalProviderSchema)
});
var ExposedInterfacesSchema = z.object({
  rest: z.array(z.string()),
  mcp: z.array(z.string()),
  sdk: z.array(z.string()),
  cli: z.array(z.string()),
  ui: z.array(z.string()),
  webhooks: z.array(z.string())
});
var ExposureSurfaceSchema = z.object({
  type: z.enum(["API", "MCP", "SDK", "UI", "Job", "Event", "CLI", "Webhook"]),
  identifier: z.string(),
  description: z.string(),
  status: z.string(),
  stableId: z.string().optional(),
  semanticVersion: z.string().optional(),
  priorVersionPointer: z.string().optional(),
  deprecationFlag: z.boolean().optional(),
  replacementPointer: z.string().optional()
});
var CapabilityPricingSchema = z.object({
  billingUnit: z.string(),
  priceFloor: z.number(),
  includedQuota: z.string(),
  overage: z.string(),
  settlementCompat: z.string(),
  costToServe: z.string(),
  marginEstimate: z.number()
});
var CapabilityGovernanceSchema = z.object({
  requiredApprovals: z.array(z.string()),
  budgetRules: z.string(),
  dataBoundaries: z.string(),
  delegations: z.string(),
  auditReqs: z.string(),
  killSwitchRules: z.string(),
  limits: z.string()
});
var CapabilityEvidenceSchema = z.object({
  evidenceProduced: z.string(),
  hashAlgorithm: z.string(),
  ledgerStorage: z.string(),
  verifiable: z.boolean(),
  privateDetails: z.string(),
  completedProof: z.string(),
  classification: z.enum([
    "VERIFIED_EXISTING",
    "INFERRED_FROM_CODE",
    "RESEARCH_SUPPORTED",
    "PROJECTED_BUSINESS_ASSUMPTION",
    "UNVERIFIED_DESIGN_INTENT"
  ]),
  evidenceTimestamp: z.string().optional(),
  freshnessWindowDays: z.number().optional(),
  nextRevalidationDue: z.string().optional(),
  trustDecayFactor: z.number().optional()
});
var ProductionEligibilitySchema = z.object({
  minTests: z.number(),
  requiredEvidence: z.string(),
  securityReviewChecked: z.boolean(),
  codeSignRequired: z.boolean()
});
var PromotionRuleSchema = z.object({
  targetMaturity: z.string(),
  requiredEvidenceClass: z.string(),
  requiredTestsCount: z.number(),
  extraValidationNeeded: z.string()
});
var CapabilityVerificationSchema = z.object({
  unitTests: z.array(z.string()),
  contractTests: z.array(z.string()),
  fixtureTests: z.array(z.string()),
  mcpTests: z.array(z.string()),
  securityTests: z.array(z.string()),
  latencySlo: z.string(),
  driftChecks: z.string(),
  promotionRules: z.array(PromotionRuleSchema).optional(),
  productionEligibilityThreshold: ProductionEligibilitySchema.optional()
});
var JurisdictionOverlaySchema = z.object({
  dataBoundaryProfile: z.string(),
  jurisdictionConstraints: z.array(z.string()),
  paymentRailConstraints: z.array(z.string()),
  auditRetentionProfile: z.string(),
  allowedRegions: z.array(z.string()).optional(),
  blockedRegions: z.array(z.string()).optional(),
  modifiedBehaviorByRegion: z.record(z.string(), z.string()).optional(),
  fallbackInteractionPattern: z.string().optional()
});
var CapabilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  purpose: z.string(),
  businessOutcome: z.string(),
  machineOutcome: z.string(),
  inputs: z.array(z.string()),
  outputs: z.array(z.string()),
  preconditions: z.array(z.string()),
  postconditions: z.array(z.string()),
  owner: z.string(),
  canonicalSystem: z.string(),
  supportingServices: z.array(z.string()),
  exposedInterfaces: ExposedInterfacesSchema,
  exposureSurfaces: z.array(ExposureSurfaceSchema),
  pricingModel: CapabilityPricingSchema,
  governance: CapabilityGovernanceSchema,
  evidence: CapabilityEvidenceSchema,
  verification: CapabilityVerificationSchema,
  dependencies: z.array(z.string()),
  lifecycleState: z.string(),
  maturityState: z.string(),
  verificationState: z.string(),
  pricingState: z.string(),
  deprecationState: z.string(),
  jurisdictionPolicy: JurisdictionOverlaySchema,
  stableId: z.string().optional(),
  semanticVersion: z.string().optional(),
  priorVersionPointer: z.string().optional(),
  deprecationFlag: z.boolean().optional(),
  replacementPointer: z.string().optional()
});
var ProductOfferingSchema = z.object({
  name: z.string(),
  description: z.string(),
  capabilities: z.array(z.string()),
  priceModel: z.string(),
  entitlements: z.array(z.string())
});
var GapReportSchema = z.object({
  system: z.string(),
  missing: z.string(),
  severity: z.enum(["Critical", "Medium", "Low"]),
  impact: z.string()
});
var AgentPacketSchema = z.object({
  id: z.string(),
  title: z.string(),
  targetRole: z.string(),
  summary: z.string(),
  objective: z.string(),
  scope: z.string(),
  files: z.array(z.string()),
  contracts: z.string(),
  dependencies: z.array(z.string()),
  tests: z.array(z.string()),
  migrations: z.string(),
  performanceTargets: z.string(),
  securityConstraints: z.string(),
  docsToUpdate: z.array(z.string()),
  definitionOfDone: z.array(z.string()),
  rollbackNotes: z.string()
});
var CanonicalBlueprintV1Schema = z.object({
  title: z.string(),
  tagline: z.string(),
  timestamp: z.string(),
  hash: z.string(),
  highLevelGoals: z.array(GoalSchema),
  competitiveMoat: z.array(MoatSchema),
  einsteinProbability: EinsteinProbabilitySchema,
  academicGrounding: z.array(AcademicPaperSchema),
  companyGraph: CompanyGraphSchema,
  capabilities: z.array(CapabilitySchema),
  productOfferings: z.array(ProductOfferingSchema),
  gapsReport: z.array(GapReportSchema),
  files: z.array(VirtualFileSchema),
  agentPackets: z.array(AgentPacketSchema).optional()
});
var PlanStepSchema = z.object({
  stepId: z.string().uuid(),
  sequence: z.number().int().positive(),
  capability: z.string(),
  lane: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  inputSchema: z.record(z.string(), z.unknown()),
  expectedOutput: z.record(z.string(), z.unknown()),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  requiresApproval: z.boolean(),
  approvalToken: z.string().optional(),
  idempotencyKey: z.string(),
  executedAt: z.string().optional(),
  resultHash: z.string().optional()
});
var PlanIRSchema = z.object({
  planId: z.string().uuid(),
  version: z.string(),
  status: z.enum(["DRAFT", "COMPILED", "PENDING_APPROVAL", "APPROVED", "REJECTED", "EXECUTING", "COMPLETE", "HALTED"]),
  tenantId: z.string(),
  agentId: z.string(),
  compiledAt: z.string(),
  approvedAt: z.string().optional(),
  intent: z.string().max(2e3),
  steps: z.array(PlanStepSchema),
  canonicalHash: z.string(),
  signature: z.string().optional(),
  einsteinScore: z.number().optional(),
  ssrnValidated: z.boolean().optional(),
  x402ReservationId: z.string().optional(),
  pglReceiptId: z.string().optional(),
  replayable: z.boolean()
});
var ApprovalTokenSchema = z.object({
  issuer: z.string(),
  tenantId: z.string(),
  planId: z.string().uuid(),
  canonicalHash: z.string(),
  stepId: z.string().uuid(),
  allowedCapability: z.string(),
  allowedRepositories: z.array(z.string()),
  allowedFiles: z.array(z.string()),
  issuedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  nonce: z.string(),
  signature: z.string().regex(/^[0-9a-f]{64}$/i, "signature must be a 64-character hexadecimal digest")
});
var CheckpointSchema = z.object({
  checkpointId: z.string(),
  parentCheckpointId: z.string().nullable().optional(),
  blueprintHash: z.string(),
  packetHash: z.string(),
  repositoryCommitSha: z.string(),
  modifiedFiles: z.array(z.string()),
  testResults: z.record(z.string(), z.unknown()),
  unresolvedWork: z.string(),
  agentIdentity: z.string(),
  timestamp: z.string()
});
var ExecutionEvidenceSchema = z.object({
  testResults: z.record(z.string(), z.unknown()),
  diffs: z.array(z.object({
    filePath: z.string(),
    diffContent: z.string()
  }))
});

// src/core/config.ts
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();
function getSecret(name) {
  const value = process.env[name];
  if (process.env.NODE_ENV === "production") {
    if (!value) {
      throw new Error(`CRITICAL: Cryptographic secret ${name} is absent in production!`);
    }
  }
  const actual = value || crypto.randomBytes(32).toString("hex");
  if (actual.length < 16) {
    throw new Error(`CRITICAL: Cryptographic secret ${name} is too short (must be at least 16 characters)`);
  }
  return actual;
}
var SEKED_HMAC_SECRET = getSecret("SEKED_HMAC_SECRET");
var CONSTITUTION_SIGNING_KEY = getSecret("CONSTITUTION_SIGNING_KEY");
var APPROVAL_TOKEN_SECRET = getSecret("APPROVAL_TOKEN_SECRET");

// src/core/crypto-utils.ts
import crypto2 from "crypto";
function normalizeHexDigest(value) {
  const trimmed = value.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(trimmed) || trimmed.length % 2 !== 0) {
    return null;
  }
  return trimmed;
}
function safeTimingSafeEqualHex(expectedHex, actualHex) {
  const expected = normalizeHexDigest(expectedHex);
  const actual = normalizeHexDigest(actualHex);
  if (!expected || !actual) {
    return false;
  }
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(actual, "hex");
  if (left.length !== right.length) {
    return false;
  }
  return crypto2.timingSafeEqual(left, right);
}

// src/core/token.ts
function signApprovalToken(token) {
  const { signature, ...rest } = token;
  const payload = stableStringify(rest);
  return crypto3.createHmac("sha256", APPROVAL_TOKEN_SECRET).update(payload).digest("hex");
}
function verifyAndValidateApprovalToken(tokenInput) {
  let tokenObj = tokenInput;
  if (typeof tokenInput === "string") {
    try {
      tokenObj = JSON.parse(tokenInput);
    } catch {
      try {
        tokenObj = JSON.parse(Buffer.from(tokenInput, "base64").toString("utf-8"));
      } catch {
        throw new Error("Invalid token format \u2014 must be valid JSON or base64-encoded JSON");
      }
    }
  }
  const parsed = ApprovalTokenSchema.safeParse(tokenObj);
  if (!parsed.success) {
    throw new Error(`Token validation failed: ${parsed.error.issues.map((e) => e.path.join(".") + ": " + e.message).join(", ")}`);
  }
  const token = parsed.data;
  const expectedSig = signApprovalToken(token);
  if (!safeTimingSafeEqualHex(expectedSig, token.signature)) {
    throw new Error("Invalid token signature \u2014 cryptographic tampering detected");
  }
  const now = /* @__PURE__ */ new Date();
  const expires = new Date(token.expiresAt);
  if (now > expires) {
    throw new Error(`Token expired at ${token.expiresAt} (current time is ${now.toISOString()})`);
  }
  return token;
}

// src/compiler/seked.ts
import crypto4 from "crypto";
var SEKED_SYSTEM_SECRET = SEKED_HMAC_SECRET;
function signAgentPacket(packet) {
  const payload = `${packet.id}|${packet.title}|${packet.scope}|${[...packet.files].sort().join(",")}|${packet.contracts}`;
  return crypto4.createHmac("sha256", SEKED_SYSTEM_SECRET).update(payload).digest("hex");
}
function verifyAgentPacket(packet, signature) {
  const expectedSig = signAgentPacket(packet);
  return safeTimingSafeEqualHex(expectedSig, signature);
}

// src/tests/security-hardening.test.ts
describe("Security hardening regressions", () => {
  it("rejects private network URLs by default", () => {
    assert.throws(() => {
      validateHttpBaseUrl("http://127.0.0.1:8080/v1", { label: "backend URL" });
    }, /private network/i);
    assert.strictEqual(
      validateHttpBaseUrl("https://example.com/v1", { label: "backend URL" }),
      "https://example.com/v1"
    );
  });
  it("permits local URLs only when explicitly allowed", () => {
    assert.strictEqual(
      validateHttpBaseUrl("http://127.0.0.1:8080/v1", { label: "backend URL", allowLocalNetworks: true }),
      "http://127.0.0.1:8080/v1"
    );
  });
  it("rejects malformed approval signatures safely", () => {
    const token = {
      issuer: "CAPPO_AUTHORIZER_MAIN",
      tenantId: "tenant-999",
      planId: "3b235378-0cf7-4fbe-9014-996ff4207901",
      canonicalHash: "ae24f5a6b0c2d3e4f5a6b0c2d3e4f5a6b0c2d3e4f5a6b0c2d3e4f5a6b0c2d3e4",
      stepId: "f92b7cfa-4687-43cf-be44-fa3046124cb1",
      allowedCapability: "Sovereign Settlement Layer",
      allowedRepositories: ["https://github.com/apex/sovereign"],
      allowedFiles: ["src/scheduler/einstein.rs", "src/scheduler/telemetry.rs"],
      issuedAt: (/* @__PURE__ */ new Date()).toISOString(),
      expiresAt: new Date(Date.now() + 36e5).toISOString(),
      nonce: "xyz-777",
      signature: ""
    };
    const signed = signApprovalToken(token);
    assert.match(signed, /^[0-9a-f]{64}$/i);
    assert.throws(() => {
      verifyAndValidateApprovalToken({ ...token, signature: "not-a-hex-digest" });
    }, /signature/);
  });
  it("does not mutate packet file ordering while signing", () => {
    const packet = {
      id: "pkt-1",
      title: "Packet",
      scope: "Scope",
      files: ["b.ts", "a.ts"],
      contracts: "Contract",
      status: "draft"
    };
    const originalOrder = [...packet.files];
    const signature = signAgentPacket(packet);
    assert.deepStrictEqual(packet.files, originalOrder);
    assert.strictEqual(verifyAgentPacket(packet, signature), true);
    assert.strictEqual(verifyAgentPacket(packet, "00"), false);
  });
});
