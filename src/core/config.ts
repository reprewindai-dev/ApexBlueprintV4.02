import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

function getSecret(name: string): string {
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

export const SEKED_HMAC_SECRET = getSecret("SEKED_HMAC_SECRET");
export const CONSTITUTION_SIGNING_KEY = getSecret("CONSTITUTION_SIGNING_KEY");
export const APPROVAL_TOKEN_SECRET = getSecret("APPROVAL_TOKEN_SECRET");
