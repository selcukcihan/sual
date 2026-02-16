import { parsePositiveInt } from "./shared/http";
import type { Env } from "./shared/types";

export type CachedGuidance = {
  payload: Record<string, unknown>;
  createdAt: number;
};

export async function getGuidanceCache(
  db: D1Database,
  input: { question: string; lang: string; model: string; cacheVersion: string; scopeKey: string }
): Promise<CachedGuidance | null> {
  const nowSec = Math.floor(Date.now() / 1000);
  const questionNorm = normalizeQuestionForCache(input.question);
  const key = await buildCacheKey(questionNorm, input.lang, input.model, input.cacheVersion, input.scopeKey);

  const row = await db
    .prepare(
      `SELECT response_json, created_at
       FROM guidance_cache
       WHERE cache_key = ? AND expires_at > ?`
    )
    .bind(key, nowSec)
    .first<{ response_json: string; created_at: number }>();

  if (!row?.response_json) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(row.response_json);
  } catch {
    return null;
  }

  if (!isValidCachedPayload(payload)) {
    return null;
  }

  await db
    .prepare(
      `UPDATE guidance_cache
       SET hit_count = hit_count + 1,
           last_hit_at = ?
       WHERE cache_key = ?`
    )
    .bind(nowSec, key)
    .run();

  return {
    payload: payload as Record<string, unknown>,
    createdAt: Number(row.created_at || nowSec),
  };
}

export async function setGuidanceCache(
  db: D1Database,
  env: Env,
  input: {
    question: string;
    lang: string;
    model: string;
    cacheVersion: string;
    scopeKey: string;
    payload: Record<string, unknown>;
  }
): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  const ttlSec = parsePositiveInt(env.CACHE_TTL_SEC, 60 * 60 * 24 * 14);
  const expiresAt = nowSec + ttlSec;
  const questionNorm = normalizeQuestionForCache(input.question);
  const key = await buildCacheKey(questionNorm, input.lang, input.model, input.cacheVersion, input.scopeKey);

  if (Math.random() < 0.02) {
    await db.prepare(`DELETE FROM guidance_cache WHERE expires_at < ?`).bind(nowSec).run();
  }

  await db
    .prepare(
      `INSERT INTO guidance_cache (
         cache_key, question_norm, lang, model, cache_version,
         response_json, created_at, expires_at, hit_count, last_hit_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
       ON CONFLICT(cache_key) DO UPDATE SET
         response_json = excluded.response_json,
         created_at = excluded.created_at,
         expires_at = excluded.expires_at,
         cache_version = excluded.cache_version`
    )
    .bind(
      key,
      questionNorm,
      normalizeLang(input.lang),
      input.model,
      input.cacheVersion,
      JSON.stringify(input.payload),
      nowSec,
      expiresAt
    )
    .run();
}

export function normalizeQuestionForCache(value: string): string {
  let text = String(value || "");
  text = text
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[’`]/g, "'")
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  // Strip common filler phrasing that doesn't materially change intent.
  const fillerPatterns = [
    /\b(?:please|pls|can you|could you|would you|help me|i need help|quick question)\b/g,
    /\b(?:lutfen|lütfen|yardim eder misin|yardım eder misin|bir soru|kisa bir soru|kısa bir soru)\b/g,
  ];
  for (const pattern of fillerPatterns) {
    text = text.replace(pattern, " ");
  }

  return text
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}

async function buildCacheKey(
  questionNorm: string,
  lang: string,
  model: string,
  cacheVersion: string,
  scopeKey: string
): Promise<string> {
  const base = `${cacheVersion}|${normalizeLang(lang)}|${model}|${scopeKey}|${questionNorm}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(base));
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeLang(value: string): string {
  return value === "en" ? "en" : "tr";
}

function isValidCachedPayload(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.answer !== "string") return false;
  if (!Array.isArray(obj.principles)) return false;
  if (!Array.isArray(obj.actions)) return false;
  if (typeof obj.disclaimer !== "string") return false;
  if (!Array.isArray(obj.citations)) return false;
  if (!Array.isArray(obj.retrieved)) return false;
  return true;
}
