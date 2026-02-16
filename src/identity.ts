import { isProduction } from "./shared/http";
import type { Env } from "./shared/types";

const COOKIE_NAME = "sual_uid";
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AnonIdentity = {
  anonId: string;
  setCookie?: string;
};

export async function ensureAnonIdentity(request: Request, env: Env): Promise<AnonIdentity> {
  const secret = getIdentitySecret(env);
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const existing = cookies.get(COOKIE_NAME);

  if (existing) {
    const verified = await verifySignedCookieValue(existing, secret);
    if (verified) {
      return { anonId: verified };
    }
  }

  const anonId = crypto.randomUUID();
  const signed = await signCookieValue(anonId, secret);
  const setCookie = buildSetCookieHeader(COOKIE_NAME, signed, isProduction(env));
  return { anonId, setCookie };
}

function getIdentitySecret(env: Env): string {
  return env.ANON_ID_SECRET || env.RATE_LIMIT_SALT || "local-dev-anon-secret";
}

function parseCookies(header: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!header) return out;

  const parts = header.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    out.set(key, value);
  }
  return out;
}

async function signCookieValue(anonId: string, secret: string): Promise<string> {
  const payload = `v1:${anonId}`;
  const sig = await hmacSha256Base64Url(secret, payload);
  return `v1.${anonId}.${sig}`;
}

async function verifySignedCookieValue(value: string, secret: string): Promise<string | null> {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [version, anonId, sig] = parts;
  if (version !== "v1") return null;
  if (!ID_PATTERN.test(anonId)) return null;
  if (!sig) return null;

  const expected = await hmacSha256Base64Url(secret, `v1:${anonId}`);
  if (!timingSafeEqual(sig, expected)) return null;
  return anonId;
}

function buildSetCookieHeader(name: string, value: string, secure: boolean): string {
  const attrs = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${COOKIE_MAX_AGE_SEC}`,
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

async function hmacSha256Base64Url(secret: string, data: string): Promise<string> {
  const keyMaterial = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return toBase64Url(new Uint8Array(sig));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
