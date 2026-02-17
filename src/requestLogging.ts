import { getClientIp, isProduction } from "./shared/http";
import type { Env } from "./shared/types";

export type RequestLogRecord = {
  publicId?: string;
  anonId: string;
  questionText: string;
  lang: string;
  status: string;
  httpStatus: number;
  llmUsed?: boolean;
  llmError?: string;
  retrievedCount?: number;
  responsePayload?: unknown;
};

export async function logGuidanceRequest(request: Request, env: Env, record: RequestLogRecord): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  const salt = env.ANON_ID_SECRET || env.RATE_LIMIT_SALT || "local-dev-log-salt";
  const ipHash = await sha256Hex16(`${salt}|ip|${getClientIp(request)}`);
  const userAgent = request.headers.get("user-agent") || "";
  const userAgentHash = await sha256Hex16(`${salt}|ua|${userAgent}`);

  try {
    await upsertAnonUser(env.DB, {
      anonId: record.anonId,
      nowSec,
      ipHash,
      userAgentHash,
    });

    await env.DB.prepare(
      `INSERT INTO guidance_request (
         public_id, anon_id, created_at, lang, question_text, status, http_status,
         ip_hash, user_agent_hash, llm_used, llm_error, retrieved_count, response_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        record.publicId || null,
        record.anonId,
        nowSec,
        normalizeLang(record.lang),
        normalizeQuestion(record.questionText),
        sanitizeStatus(record.status),
        record.httpStatus,
        ipHash,
        userAgentHash,
        typeof record.llmUsed === "boolean" ? (record.llmUsed ? 1 : 0) : null,
        sanitizeError(record.llmError),
        typeof record.retrievedCount === "number" ? Math.max(0, record.retrievedCount) : null,
        serializeResponsePayload(record.responsePayload)
      )
      .run();
  } catch (err) {
    if (!isProduction(env)) {
      console.log(`[logging] failed to write request log: ${String(err)}`);
    }
  }
}

async function upsertAnonUser(
  db: D1Database,
  input: { anonId: string; nowSec: number; ipHash: string; userAgentHash: string }
): Promise<void> {
  await db.prepare(
    `INSERT INTO anon_user (
       anon_id, created_at, first_seen_at, last_seen_at,
       first_ip_hash, first_user_agent_hash, last_ip_hash, last_user_agent_hash, request_count
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(anon_id) DO UPDATE SET
       last_seen_at = excluded.last_seen_at,
       last_ip_hash = excluded.last_ip_hash,
       last_user_agent_hash = excluded.last_user_agent_hash,
       request_count = anon_user.request_count + 1`
  )
    .bind(
      input.anonId,
      input.nowSec,
      input.nowSec,
      input.nowSec,
      input.ipHash,
      input.userAgentHash,
      input.ipHash,
      input.userAgentHash
    )
    .run();
}

async function sha256Hex16(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const bytes = Array.from(new Uint8Array(digest)).slice(0, 16);
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeLang(value: string): string {
  return value === "en" ? "en" : "tr";
}

function normalizeQuestion(value: string): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);
}

function sanitizeStatus(value: string): string {
  return (value || "unknown").slice(0, 40);
}

function sanitizeError(value: string | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 500);
}

function serializeResponsePayload(value: unknown): string | null {
  if (value === undefined) return null;
  try {
    const encoded = JSON.stringify(value);
    if (!encoded) return null;
    return encoded;
  } catch {
    return null;
  }
}
