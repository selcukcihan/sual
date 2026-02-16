import { getClientIp, isProduction, parsePositiveInt } from "./shared/http";
import type { Env } from "./shared/types";

export type TurnstileResult = { ok: boolean; statusCode?: number; message?: string };

export async function verifyTurnstile(token: string, request: Request, env: Env): Promise<TurnstileResult> {
  const production = isProduction(env);
  const allowInsecureLocalBypass = !production && isTruthy(env.ALLOW_INSECURE_LOCAL_BYPASS);
  if (allowInsecureLocalBypass) {
    return { ok: true };
  }

  const siteKey = (env.TURNSTILE_SITE_KEY || "").trim();
  const secretKey = (env.TURNSTILE_SECRET_KEY || "").trim();
  const turnstileConfigured = Boolean(siteKey && secretKey);
  const required = production || Boolean(siteKey || secretKey);

  if (!required) {
    return { ok: true };
  }
  if (!turnstileConfigured) {
    return {
      ok: false,
      statusCode: 503,
      message: "Turnstile is required but not configured.",
    };
  }
  if (!token.trim()) {
    return {
      ok: false,
      statusCode: 400,
      message: "Turnstile token is missing.",
    };
  }

  const ip = getClientIp(request);
  const form = new URLSearchParams();
  form.set("secret", secretKey);
  form.set("response", token);
  if (ip && ip !== "unknown") {
    form.set("remoteip", ip);
  }

  let resp: Response;
  try {
    resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
  } catch {
    return { ok: false, statusCode: 502, message: "Turnstile verification unavailable." };
  }

  if (!resp.ok) {
    return { ok: false, statusCode: 502, message: "Turnstile verification failed upstream." };
  }

  const verification = (await resp.json()) as {
    success?: boolean;
  };

  if (!verification.success) {
    return {
      ok: false,
      statusCode: 403,
      message: "Turnstile validation failed.",
    };
  }

  return { ok: true };
}

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  max: number;
  windowSec: number;
  retryAfterSec: number;
};

export async function applyRateLimit(request: Request, env: Env): Promise<RateLimitResult> {
  const ip = getClientIp(request);
  const ipKey = await stableRateLimitKey(ip, env.RATE_LIMIT_SALT || "");
  const max = parsePositiveInt(env.RATE_LIMIT_MAX, 30);
  const windowSec = parsePositiveInt(env.RATE_LIMIT_WINDOW_SEC, 60);
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(nowSec / windowSec) * windowSec;
  const windowKey = `${ipKey}:${windowStart}`;
  const expiresAt = windowStart + windowSec + 5;

  if (Math.random() < 0.05) {
    await env.DB.prepare(`DELETE FROM rate_limit WHERE expires_at < ?`).bind(nowSec).run();
  }

  const upsertSql = `
    INSERT INTO rate_limit (id, ip, window_start, count, expires_at)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(id) DO UPDATE SET count = count + 1
    RETURNING count
  `;
  const result = await env.DB.prepare(upsertSql).bind(windowKey, ipKey, windowStart, expiresAt).first<{ count: number }>();
  const count = Number(result?.count || 1);
  const retryAfterSec = Math.max(1, windowStart + windowSec - nowSec);
  return {
    allowed: count <= max,
    count,
    max,
    windowSec,
    retryAfterSec,
  };
}

async function stableRateLimitKey(ip: string, salt: string): Promise<string> {
  const input = `${salt}|${ip || "unknown"}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const bytes = Array.from(new Uint8Array(digest)).slice(0, 16);
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isTruthy(value: string | undefined): boolean {
  const normalized = (value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}
