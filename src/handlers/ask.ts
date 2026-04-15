import {
  GUIDANCE_CACHE_VERSION,
  MAX_BODY_BYTES,
  MAX_QUESTION_CHARS,
  RETRIEVAL_CACHE_VERSION,
} from "../shared/constants";
import { json, isJsonRequest, shouldExposeDebugMeta } from "../shared/http";
import { generateGuidance } from "../guidance";
import { getGuidanceCache, setGuidanceCache } from "../guidanceCache";
import { ensureAnonIdentity } from "../identity";
import { moderateQuestionInput, type ModerationResult } from "../moderation";
import { logGuidanceRequest } from "../requestLogging";
import { getAyatByIds, retrieveAyat } from "../retrieval";
import { getRetrievalCache, setRetrievalCache } from "../retrievalCache";
import { applyRateLimit, checkAbuseControls, verifyTurnstile } from "../security";
import type { AyahRow, Env } from "../shared/types";

export async function handleAsk(request: Request, env: Env): Promise<Response> {
  const identity = await ensureAnonIdentity(request, env);
  const baseHeaders: Record<string, string> = identity.setCookie ? { "set-cookie": identity.setCookie } : {};
  let rawQuestion = "";
  let requestLang = "tr";
  let publicQueryId: string | null = null;
  let moderationShareAllowed = false;
  let moderationResult: ModerationResult | null = null;

  function getOrCreatePublicQueryId(): string {
    if (!publicQueryId) {
      publicQueryId = crypto.randomUUID();
    }
    return publicQueryId;
  }

  function withPublicQueryId(payload: unknown, shareable: boolean): unknown {
    if (!shareable) {
      return payload;
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return payload;
    }
    const record = payload as Record<string, unknown>;
    return { ...record, query_id: getOrCreatePublicQueryId() };
  }

  async function respond(
    payload: unknown,
    status: number,
    logStatus: string,
    meta?: { llmUsed?: boolean; llmError?: string; retrievedCount?: number },
    extraHeaders?: Record<string, string>
  ): Promise<Response> {
    const shareable = meta?.llmUsed === true && moderationShareAllowed;
    const payloadWithId = withPublicQueryId(payload, shareable);
    await logGuidanceRequest(request, env, {
      publicId: shareable ? getOrCreatePublicQueryId() : undefined,
      anonId: identity.anonId,
      questionText: rawQuestion,
      lang: requestLang,
      status: logStatus,
      httpStatus: status,
      llmUsed: meta?.llmUsed,
      llmError: meta?.llmError,
      retrievedCount: meta?.retrievedCount,
      responsePayload: payloadWithId,
      moderationStatus: moderationResult?.outcome,
      moderationFlagged: moderationResult?.flagged,
      moderationInput: moderationResult?.input,
      moderationOutput: moderationResult?.output,
      moderationError: moderationResult?.error,
    });
    return json(payloadWithId, status, { ...baseHeaders, ...(extraHeaders || {}) });
  }

  if (!isJsonRequest(request)) {
    return respond({ error: "content-type must be application/json" }, 415, "invalid_content_type");
  }
  const declaredSize = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES) {
    return respond({ error: `Request body exceeds ${MAX_BODY_BYTES} bytes` }, 413, "payload_too_large");
  }

  const abuseResult = await checkAbuseControls(request, env);
  if (!abuseResult.allowed) {
    return respond({ error: "Temporary abuse protection triggered. Please try again later." }, 429, "abuse_blocked", undefined, { "retry-after": String(abuseResult.retryAfterSec || 60) });
  }

  const rateResult = await applyRateLimit(request, env);
  if (!rateResult.allowed) {
    return respond(
      {
        error: requestLang === "tr"
          ? "Oran limiti aşıldı. Lütfen kısa süre sonra tekrar deneyin."
          : "Rate limit exceeded. Please retry shortly.",
      },
      429,
      "rate_limited",
      undefined,
      { "retry-after": String(rateResult.retryAfterSec) }
    );
  }

  // rest of file unchanged
}
