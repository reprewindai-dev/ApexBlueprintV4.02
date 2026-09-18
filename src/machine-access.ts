/**
 * Apex machine-access contract.
 *
 * Production policy: discovery is free; every capability invocation is paid.
 * This module deliberately does not pretend a payment happened. A configured
 * external verifier must attest the payment before the request may proceed.
 */

import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

export const APEX_MACHINE_VERSION = "2026-09-18";
export const APEX_CURRENCY = process.env.APEX_PRICE_CURRENCY || "USD";

const defaultPriceMinor = Number.parseInt(process.env.APEX_DEFAULT_PRICE_MINOR || "100", 10);

export const apexMachineCapabilities = [
  { id: "blueprint.generate", method: "POST", path: "/api/generate" },
  { id: "seked.compile", method: "POST", path: "/api/seked/compile" },
  { id: "repo.intelligence", method: "GET", path: "/api/repo-intelligence" },
  { id: "constitution.sign", method: "POST", path: "/api/constitution/sign" },
] as const;

export function priceFor(capabilityId: string): number {
  const key = `APEX_PRICE_${capabilityId.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}_MINOR`;
  const configured = Number.parseInt(process.env[key] || "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : defaultPriceMinor;
}

export function machineManifest(baseUrl: string) {
  return {
    service: "Apex Blueprint",
    version: APEX_MACHINE_VERSION,
    audience: "machines-and-humans",
    policy: {
      discovery: "free",
      capabilityInvocation: "paid",
      freeExecutionQuota: 0,
      failClosed: true,
    },
    payment: {
      protocol: process.env.APEX_PAYMENT_PROTOCOL || "x402",
      currency: APEX_CURRENCY,
      verifierConfigured: Boolean(process.env.APEX_PAYMENT_VERIFY_URL),
    },
    endpoints: apexMachineCapabilities.map((capability) => ({
      ...capability,
      url: `${baseUrl}${capability.path}`,
      priceMinor: priceFor(capability.id),
    })),
  };
}

function requestBaseUrl(req: Request): string {
  const configured = process.env.APEX_PUBLIC_URL?.replace(/\/$/, "");
  if (configured) return configured;
  return `${req.protocol}://${req.get("host")}`;
}

export function apexDiscovery(req: Request, res: Response) {
  res.setHeader("Cache-Control", "public, max-age=60");
  return res.json(machineManifest(requestBaseUrl(req)));
}

function paymentRequired(req: Request, res: Response, capabilityId: string, reason: string) {
  const priceMinor = priceFor(capabilityId);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Payment-Required", "true");
  res.setHeader("X-Apex-Capability", capabilityId);
  res.setHeader("X-Apex-Price-Minor", String(priceMinor));
  res.setHeader("X-Apex-Currency", APEX_CURRENCY);
  res.setHeader("Link", '</.well-known/apex.json>; rel="service-desc"');
  return res.status(402).json({
    error: "PAYMENT_REQUIRED",
    reason,
    capability: capabilityId,
    amountMinor: priceMinor,
    currency: APEX_CURRENCY,
    protocol: process.env.APEX_PAYMENT_PROTOCOL || "x402",
    discovery: "/.well-known/apex.json",
  });
}

export function requirePaidCapability(capabilityId: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const verifierUrl = process.env.APEX_PAYMENT_VERIFY_URL;
    if (!verifierUrl) {
      return paymentRequired(req, res, capabilityId, "payment_verifier_not_configured");
    }

    const payment = req.get("Payment") || req.get("X-Payment") || req.get("Authorization");
    if (!payment) {
      return paymentRequired(req, res, capabilityId, "payment_proof_missing");
    }

    const bodyHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(req.body ?? null))
      .digest("hex");

    try {
      const verify = await fetch(verifierUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capability: capabilityId,
          amountMinor: priceFor(capabilityId),
          currency: APEX_CURRENCY,
          method: req.method,
          path: req.path,
          bodyHash,
          payment,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!verify.ok) {
        return paymentRequired(req, res, capabilityId, "payment_not_verified");
      }

      const result = await verify.json().catch(() => ({})) as { verified?: boolean; receiptId?: string };
      if (result.verified !== true) {
        return paymentRequired(req, res, capabilityId, "payment_not_verified");
      }

      res.setHeader("X-Apex-Payment-Verified", "true");
      if (result.receiptId) res.setHeader("X-Apex-Receipt-Id", result.receiptId);
      return next();
    } catch {
      return paymentRequired(req, res, capabilityId, "payment_verifier_unavailable");
    }
  };
}
