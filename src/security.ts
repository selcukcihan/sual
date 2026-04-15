import { getClientIp, isProduction, parsePositiveInt } from "./shared/http";
import type { Env } from "./shared/types";

export type TurnstileResult = { ok: boolean; statusCode?: number; message?: string };
export type AbuseCheckResult = { allowed: boolean; blocked: boolean; score: number; threshold: number; reason?: string; retryAfterSec?: number };

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
    hostname?: string;
    action?: string;
    cdata?: string;
    "error-codes"?: string[];
  };

  if (!verification.success) {
    return {
      ok: false,
      statusCode: 403,
      message: "Turnstile validation failed.",
    };
  }

  const expectedHostname = (env.TURNSTILE_EXPECTED_HOSTNAME || new URL(request.url).hostname).trim().toLowerCase();
  if (expectedHostname) {
    const actualHostname = (verification.hostname || "").trim().toLowerCase();
    if (!actualHostname || actualHostname !== expectedHostname) {
      return {
        ok: false,
        statusCode: 403,
        message: "Turnstile hostname mismatch.",
      };
    }
  }

  const expectedAction = (env.TURNSTILE_EXPECTED_ACTION || "ask_guidance").trim();
  if (expectedAction) {
    const actualAction = (verification.action || "").trim();
    if (!actualAction || actualAction !== expectedAction) {
      return {
        ok: false,
        statusCode: 403,
        message: "Turnstile action mismatch.",
      };
    }
  }

  return { ok: true };
}

export async function checkAbuseControls(request: Request, env: Env): Promise<AbuseCheckResult> {
  const production = isProduction(env);
  if (!production && isTruthy(env.ABUSE_CONTROL_LOCAL_BYPASS)) {
    return { allowed: true, blocked: false, score: 0, threshold: parsePositiveInt(env.ABUSE_CONTROL_THRESHOLD, 8) };
  }

  const enabled = production || isTruthy(env.ABUSE_CONTROL_ENABLED);
  const threshold = parsePositiveInt(env.ABUSE_CONTROL_THRESHOLD, 8);
  const blockMinutes = parsePositiveInt(env.ABUSE_CONTROL_BLOCK_MINUTES, 30);
  const nowSec = Math.floor(Date.now() / 1000);
  const ip = getClientIp(request);
  const score = scoreAbuse(request, ip);

  if (!enabled) {
    return { allowed: true, blocked: false, score, threshold };
  }

  await env.DB.prepare(`DELETE FROM abuse_control WHERE expires_at < ?`).bind(nowSec).run();
  const existing = await env.DB.prepare(`SELECT reason, score, expires_at FROM abuse_control WHERE ip = ? AND expires_at >= ? ORDER BY expires_at DESC LIMIT 1`).bind(ip, nowSec).first<{ reason: string; score: number; expires_at: number }>();
  if (existing) {
    return { allowed: false, blocked: true, score: existing.score, threshold, reason: existing.reason, retryAfterSec: Math.max(1, existing.expires_at - nowSec) };
  }

  if (score >= threshold && ip !== "unknown") {
    const expiresAt = nowSec + blockMinutes * 60;
    const reason = score >= threshold + 4 ? "high_abuse_score" : "abuse_score";
    await env.DB.prepare(`INSERT OR REPLACE INTO abuse_control (id, ip, reason, score, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), ip, reason, score, nowSec, expiresAt)
      .run();
    return { allowed: false, blocked: true, score, threshold, reason, retryAfterSec: blockMinutes * 60 };
  }

  return { allowed: true, blocked: false, score, threshold };
}

function scoreAbuse(request: Request, ip: string): number {
  let score = 0;
  const ua = (request.headers.get("user-agent") || "").toLowerCase();
  const accept = (request.headers.get("accept") || "").toLowerCase();
  const origin = (request.headers.get("origin") || "").toLowerCase();
  const referer = (request.headers.get("referer") || "").toLowerCase();

  if (!ua || ua.includes("curl") || ua.includes("wget") || ua.includes("python") || ua.includes("httpie")) score += 4;
  if (!accept.includes("application/json")) score += 1;
  if (!origin && !referer) score += 1;
  if (ip === "unknown") score += 2;
  return score;
}

function isTruthy(value: string | undefined): boolean {
  const normalized = (value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}
