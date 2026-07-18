import crypto from "crypto";

export interface SekedInput {
  E: number; // Execution Jitter / Latency
  R: number; // Reputation Index
  C: number; // Compliance Score
  D: number; // Data Boundary Profile
  S: number; // Settlement Velocity
}

export type SekedDirective =
  | "TERMINATE_AND_FREEZE"
  | "DEGRADE_AND_WARN"
  | "COOPERATIVE_OPTIMIZATION"
  | "SOVEREIGN_EXECUTION";

export interface SekedResult {
  directive: SekedDirective;
  compositeScore: number;
  timestamp: string;
  signature: string;
}

export interface AgentPacket {
  id: string;
  title: string;
  scope: string;
  files: string[];
  contracts: string;
  status: string;
  signature?: string;
}

// Private system key for deterministic, mock-free cryptographic signing of directives and execution packets
const SEKED_SYSTEM_SECRET = process.env.SEKED_SYSTEM_SECRET || "APEX_SEKED_GOVERNANCE_SIGNING_KEY_SECURE_2026";

/**
 * Normalizes raw metrics into 0-9 continuous scales based on physical invariants
 */
export function normalizeTelemetry(raw: {
  latencyMs: number;
  reputationScale: number;
  unapprovedDrifts: number;
  nonCompliantRegions: number;
  settlementDelaySec: number;
}): SekedInput {
  // E (Execution Efficiency): Lower latency is better. Max latency cap is 1000ms.
  const E = Math.max(0, Math.min(9, 9 * (1 - raw.latencyMs / 1000)));

  // R (Resource Reputation): Inherent trust scale (0-1), scaled to 0-9
  const R = Math.max(0, Math.min(9, raw.reputationScale * 9));

  // C (Compliance Drift): 0 drifts is perfect (9), each drift subtracts 2 points.
  const C = Math.max(0, Math.min(9, 9 - raw.unapprovedDrifts * 2));

  // D (Data Boundary Profile): 0 non-compliant regions is perfect (9), each non-compliant region subtracts 3 points.
  const D = Math.max(0, Math.min(9, 9 - raw.nonCompliantRegions * 3));

  // S (Settlement Velocity): Lower delays are better. Max delay cap is 60 seconds.
  const S = Math.max(0, Math.min(9, 9 * (1 - raw.settlementDelaySec / 60)));

  return { E, R, C, D, S };
}

/**
 * The pure mathematical compiler of the SEKED specification.
 * It is completely detached from any generative models and functions as a deterministic gate.
 */
export function compileSekedDirective(input: SekedInput): SekedResult {
  // Validate inputs
  const E = Math.max(0, Math.min(9, input.E));
  const R = Math.max(0, Math.min(9, input.R));
  const C = Math.max(0, Math.min(9, input.C));
  const D = Math.max(0, Math.min(9, input.D));
  const S = Math.max(0, Math.min(9, input.S));

  // Pure weighted score matrix evaluation
  const compositeScore = (E * 0.2) + (R * 0.2) + (C * 0.3) + (D * 0.1) + (S * 0.2);

  let directive: SekedDirective;
  if (compositeScore < 3.0) {
    directive = "TERMINATE_AND_FREEZE";
  } else if (compositeScore < 5.0) {
    directive = "DEGRADE_AND_WARN";
  } else if (compositeScore < 7.5) {
    directive = "COOPERATIVE_OPTIMIZATION";
  } else {
    directive = "SOVEREIGN_EXECUTION";
  }

  const timestamp = new Date().toISOString();
  
  // Create cryptographic SHA-256 HMAC signature of the directive and score to lock and authorize the state
  const rawPayload = `${directive}|${compositeScore.toFixed(4)}|${timestamp}`;
  const signature = crypto
    .createHmac("sha256", SEKED_SYSTEM_SECRET)
    .update(rawPayload)
    .digest("hex");

  return {
    directive,
    compositeScore,
    timestamp,
    signature,
  };
}

/**
 * Cryptographically signs an execution packet to ensure that no unauthorized drift occurs during execution
 */
export function signAgentPacket(packet: AgentPacket): string {
  const payload = `${packet.id}|${packet.title}|${packet.scope}|${packet.files.sort().join(",")}|${packet.contracts}`;
  return crypto
    .createHmac("sha256", SEKED_SYSTEM_SECRET)
    .update(payload)
    .digest("hex");
}

/**
 * Verifies if an agent execution packet matches its cryptographic signature
 */
export function verifyAgentPacket(packet: AgentPacket, signature: string): boolean {
  const expectedSig = signAgentPacket(packet);
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSig, "hex")
  );
}
