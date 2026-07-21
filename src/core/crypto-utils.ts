import crypto from "crypto";

function normalizeHexDigest(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(trimmed) || trimmed.length % 2 !== 0) {
    return null;
  }
  return trimmed;
}

export function safeTimingSafeEqualHex(expectedHex: string, actualHex: string): boolean {
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

  return crypto.timingSafeEqual(left, right);
}
