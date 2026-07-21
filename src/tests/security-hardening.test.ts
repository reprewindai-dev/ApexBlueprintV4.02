import assert from "node:assert";
import { describe, it } from "node:test";

import { validateHttpBaseUrl } from "../core/network";
import { signApprovalToken, verifyAndValidateApprovalToken } from "../core/token";
import { signAgentPacket, verifyAgentPacket } from "../compiler/seked";

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
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
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
