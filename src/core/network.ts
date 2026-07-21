import { isIP } from "node:net";

export interface HttpUrlOptions {
  label?: string;
  allowLocalNetworks?: boolean;
}

function isPrivateHostname(hostname: string): boolean {
  const lower = hostname.trim().toLowerCase();

  if (!lower) return true;
  if (lower === "localhost" || lower.endsWith(".localhost") || lower.endsWith(".local")) return true;

  const ipVersion = isIP(lower);
  if (ipVersion === 4) {
    const [a, b] = lower.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31)
    );
  }

  if (ipVersion === 6) {
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80:")
    );
  }

  return false;
}

export function validateHttpBaseUrl(input: string, options: HttpUrlOptions = {}): string {
  const label = options.label || "URL";
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error(`${label} cannot be empty`);
  }

  let parsed: URL;
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

export function resolveHttpBaseUrl(
  value: string | undefined,
  fallback: string,
  options: HttpUrlOptions = {}
): string {
  return validateHttpBaseUrl(value?.trim() || fallback, options);
}

export function pickFirstEnvValue(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}
