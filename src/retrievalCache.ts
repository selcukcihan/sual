import { parsePositiveInt } from "./shared/http";
import type { Env } from "./shared/types";
import { normalizeQuestionForCache } from "./guidanceCache";

export async function getRetrievalCache(
  db: D1Database,
  input: { question: string; lang: string; cacheVersion: string }
): Promise<number[] | null> {
  const nowSec = Math.floor(Date.now() / 1000);
  const questionNorm = normalizeQuestionForCache(input.question);
  const key = await buildCacheKey(questionNorm, input.lang, input.cacheVersion);

  const row = await db
    .prepare(
      `SELECT ayah_ids_json
       FROM retrieval_cache
       WHERE cache_key = ? AND expires_at > ?`
    )
    .bind(key, nowSec)
    .first<{ ayah_ids_json: string }>();

  if (!row?.ayah_ids_json) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.ayah_ids_json);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) return null;
  const ids = parsed
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 20);

  if (ids.length === 0) return null;

  await db
    .prepare(
      `UPDATE retrieval_cache
       SET hit_count = hit_count + 1,
           last_hit_at = ?
       WHERE cache_key = ?`
    )
    .bind(nowSec, key)
    .run();

  return ids;
}

export async function setRetrievalCache(
  db: D1Database,
  env: Env,
  input: { question: string; lang: string; cacheVersion: string; ayahIds: number[] }
): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  const ttlSec = parsePositiveInt(env.RETRIEVAL_CACHE_TTL_SEC, 60 * 60 * 24 * 7);
  const expiresAt = nowSec + ttlSec;
  const questionNorm = normalizeQuestionForCache(input.question);
  const key = await buildCacheKey(questionNorm, input.lang, input.cacheVersion);
  const ayahIds = Array.from(new Set(input.ayahIds.filter((id) => Number.isInteger(id) && id > 0))).slice(0, 20);

  if (ayahIds.length === 0) return;

  if (Math.random() < 0.02) {
    await db.prepare(`DELETE FROM retrieval_cache WHERE expires_at < ?`).bind(nowSec).run();
  }

  await db
    .prepare(
      `INSERT INTO retrieval_cache (
         cache_key, question_norm, lang, cache_version,
         ayah_ids_json, created_at, expires_at, hit_count, last_hit_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL)
       ON CONFLICT(cache_key) DO UPDATE SET
         ayah_ids_json = excluded.ayah_ids_json,
         created_at = excluded.created_at,
         expires_at = excluded.expires_at,
         cache_version = excluded.cache_version`
    )
    .bind(
      key,
      questionNorm,
      normalizeLang(input.lang),
      input.cacheVersion,
      JSON.stringify(ayahIds),
      nowSec,
      expiresAt
    )
    .run();
}

async function buildCacheKey(questionNorm: string, lang: string, cacheVersion: string): Promise<string> {
  const base = `${cacheVersion}|${normalizeLang(lang)}|${questionNorm}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(base));
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeLang(value: string): string {
  return value === "en" ? "en" : "tr";
}
