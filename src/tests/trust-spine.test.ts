import { describe, it } from "node:test";
import assert from "node:assert";
import { stableStringify, calculateBlueprintHash } from "../core/plan-ir";
import { signApprovalToken, verifyAndValidateApprovalToken, isFileModificationAuthorized } from "../core/token";
import { CanonicalBlueprintV1Schema, PlanIRSchema } from "../core/validation";

describe("Milestone 1: Real Trust Spine Regression Tests", () => {
  
  describe("1. Recursive Stable JSON Serialization", () => {
    it("should produce identical output regardless of property order", () => {
      const objA = { z: 1, a: { y: 2, x: 3 }, b: [1, 2, 3] };
      const objB = { b: [1, 2, 3], a: { x: 3, y: 2 }, z: 1 };

      const strA = stableStringify(objA);
      const strB = stableStringify(objB);

      assert.strictEqual(strA, strB);
    });

    it("should produce a different hash when any nested property is changed (tampering)", () => {
      const blueprint1 = {
        title: "Apex Sovereign",
        tagline: "Uncompromising security",
        timestamp: "2026-07-18T12:00:00Z",
        highLevelGoals: [{ title: "Durable Ledger", description: "Use X402", status: "PENDING" }],
        capabilities: [{
          id: "cap-1",
          name: "Sovereign Escrow",
          preconditions: ["sufficient_gas"],
          postconditions: ["payment_settled"],
          verification: { unitTests: ["escrow.rs"] }
        }]
      };

      const blueprint2 = JSON.parse(JSON.stringify(blueprint1));
      // Change a single deeply nested array value
      blueprint2.capabilities[0].verification.unitTests[0] = "tampered_escrow.rs";

      const hash1 = calculateBlueprintHash(blueprint1);
      const hash2 = calculateBlueprintHash(blueprint2);

      assert.notStrictEqual(hash1, hash2, "Nested variation must produce different hashes");
    });
  });

  describe("2. Token Signature & Tampering Verification", () => {
    it("should successfully sign and verify a pristine token", () => {
      const pristineToken = {
        issuer: "CAPPO_AUTHORIZER_MAIN",
        tenantId: "tenant-999",
        planId: "3b235378-0cf7-4fbe-9014-996ff4207901",
        canonicalHash: "ae24f5a6b0c2d3e4f5a6b0c2d3e4f5a6b0c2d3e4f5a6b0c2d3e4f5a6b0c2d3e4",
        stepId: "f92b7cfa-4687-43cf-be44-fa3046124cb1",
        allowedCapability: "Sovereign Settlement Layer",
        allowedRepositories: ["https://github.com/apex/sovereign"],
        allowedFiles: ["src/scheduler/einstein.rs", "src/scheduler/telemetry.rs"],
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour in the future
        nonce: "xyz-777",
        signature: ""
      };

      const signature = signApprovalToken(pristineToken);
      pristineToken.signature = signature;

      const verified = verifyAndValidateApprovalToken(pristineToken);
      assert.strictEqual(verified.nonce, "xyz-777");
    });

    it("should reject a token if any nested property has been tampered with", () => {
      const tokenObj = {
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

      tokenObj.signature = signApprovalToken(tokenObj);

      // Attempt tampering with allowed files
      const tamperedObj = JSON.parse(JSON.stringify(tokenObj));
      tamperedObj.allowedFiles.push("forbidden_file.sh");

      assert.throws(() => {
        verifyAndValidateApprovalToken(tamperedObj);
      }, /cryptographic tampering detected/);
    });
  });

  describe("3. Out-of-Scope Files Rejection", () => {
    it("should authorize allowed files and reject any other files", () => {
      const mockToken = {
        allowedFiles: ["src/scheduler/einstein.rs", "src/scheduler/telemetry.rs"]
      };

      assert.strictEqual(isFileModificationAuthorized(mockToken, "src/scheduler/einstein.rs"), true);
      assert.strictEqual(isFileModificationAuthorized(mockToken, "src/scheduler/telemetry.rs"), true);
      assert.strictEqual(isFileModificationAuthorized(mockToken, "unauthorized_admin_script.sh"), false);
    });
  });

  describe("4. Expired Approval Tokens Failure", () => {
    it("should reject a cryptographically valid token if it has expired", () => {
      const expiredToken = {
        issuer: "CAPPO_AUTHORIZER_MAIN",
        tenantId: "tenant-999",
        planId: "3b235378-0cf7-4fbe-9014-996ff4207901",
        canonicalHash: "ae24f5a6b0c2d3e4f5a6b0c2d3e4f5a6b0c2d3e4f5a6b0c2d3e4f5a6b0c2d3e4",
        stepId: "f92b7cfa-4687-43cf-be44-fa3046124cb1",
        allowedCapability: "Sovereign Settlement Layer",
        allowedRepositories: ["https://github.com/apex/sovereign"],
        allowedFiles: ["src/scheduler/einstein.rs", "src/scheduler/telemetry.rs"],
        issuedAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        nonce: "expired-999",
        signature: ""
      };

      expiredToken.signature = signApprovalToken(expiredToken);

      assert.throws(() => {
        verifyAndValidateApprovalToken(expiredToken);
      }, /Token expired/);
    });
  });

  describe("5. Invalid Schemas Reject Intake", () => {
    it("should reject a PlanIR missing required fields via Zod", () => {
      const malformedPlan = {
        planId: "3b235378-0cf7-4fbe-9014-996ff4207901",
        version: "1.0",
        // missing tenantId and steps
        intent: "Test compile malformed plan"
      };

      const result = PlanIRSchema.safeParse(malformedPlan);
      assert.strictEqual(result.success, false);
    });

    it("should reject a blueprint with invalid type structures via Zod", () => {
      const malformedBlueprint = {
        title: 12345, // Should be string
        tagline: "Test",
        highLevelGoals: []
      };

      const result = CanonicalBlueprintV1Schema.safeParse(malformedBlueprint);
      assert.strictEqual(result.success, false);
    });
  });

});
