import { MAX_BODY_BYTES, MAX_QUESTION_CHARS } from "../shared/constants";
import { json, isJsonRequest, shouldExposeDebugMeta } from "../shared/http";
import { generateGuidance } from "../guidance";
import { ensureAnonIdentity } from "../identity";
import { logGuidanceRequest } from "../requestLogging";
import { retrieveAyat } from "../retrieval";
import { applyRateLimit, verifyTurnstile } from "../security";
import type { Env } from "../shared/types";

export async function handleAsk(request: Request, env: Env): Promise<Response> {
  const identity = await ensureAnonIdentity(request, env);
  const baseHeaders: Record<string, string> = identity.setCookie ? { "set-cookie": identity.setCookie } : {};
  let rawQuestion = "";
  let requestLang = "tr";

  async function respond(
    payload: unknown,
    status: number,
    logStatus: string,
    meta?: { llmUsed?: boolean; llmError?: string; retrievedCount?: number },
    extraHeaders?: Record<string, string>
  ): Promise<Response> {
    await logGuidanceRequest(request, env, {
      anonId: identity.anonId,
      questionText: rawQuestion,
      lang: requestLang,
      status: logStatus,
      httpStatus: status,
      llmUsed: meta?.llmUsed,
      llmError: meta?.llmError,
      retrievedCount: meta?.retrievedCount,
    });
    return json(payload, status, { ...baseHeaders, ...(extraHeaders || {}) });
  }

  if (!isJsonRequest(request)) {
    return respond({ error: "content-type must be application/json" }, 415, "invalid_content_type");
  }
  const declaredSize = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES) {
    return respond({ error: `Request body exceeds ${MAX_BODY_BYTES} bytes` }, 413, "payload_too_large");
  }

  const rateResult = await applyRateLimit(request, env);
  if (!rateResult.allowed) {
    return respond(
      {
        error: "Rate limit exceeded. Please retry shortly.",
      },
      429,
      "rate_limited",
      undefined,
      { "retry-after": String(rateResult.retryAfterSec) }
    );
  }

  let question = "";
  let lang = "tr";
  let turnstileToken = "";

  try {
    const body = (await request.json()) as { question?: string; lang?: string; turnstileToken?: string };
    question = (body.question || "").trim();
    lang = body.lang === "en" ? "en" : "tr";
    requestLang = lang;
    rawQuestion = question;
    turnstileToken = (body.turnstileToken || "").trim();
  } catch {
    return respond({ error: "Invalid JSON body" }, 400, "invalid_json");
  }

  if (!question) {
    return respond({ error: "Question is required" }, 400, "empty_question");
  }
  if (question.length > MAX_QUESTION_CHARS) {
    return respond({ error: `Question exceeds ${MAX_QUESTION_CHARS} characters` }, 400, "question_too_long");
  }
  question = question.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  rawQuestion = question;
  const turnstileResult = await verifyTurnstile(turnstileToken, request, env);
  if (!turnstileResult.ok) {
    const statusCode = turnstileResult.statusCode || 403;
    return respond(
      { error: turnstileResult.message || "Turnstile verification failed." },
      statusCode,
      "turnstile_failed"
    );
  }

  const retrieved = await retrieveAyat(env.DB, question, 8, lang);

  if (retrieved.length === 0) {
    return respond(
      {
        answer: lang === "tr"
          ? "Bu sorgu için yeterince güvenilir ayet bulamadım. Lütfen soruyu daha açık şekilde yeniden yazın."
          : "I could not find relevant ayat confidently for this query. Try rephrasing with more detail.",
        principles: [],
        actions: lang === "tr"
          ? ["Durumu bir veya iki cümle ile netleştirin.", "Etik temayı belirtin (örneğin öfke, dürüstlük, adalet)."]
          : ["Clarify the situation in one or two sentences.", "Mention the ethical theme you care about (e.g., anger, honesty, justice)."],
        disclaimer: lang === "tr"
          ? "Bu, Kur'an temelli rehberlik desteğidir; fetva değildir. Hüküm için ehil bir alime danışın."
          : "This is Quran-based guidance support, not a fatwa. Consult a qualified scholar for legal rulings.",
        citations: [],
      },
      200,
      "no_retrieval",
      { retrievedCount: 0 }
    );
  }

  const guidanceResult = await generateGuidance(question, retrieved, env, lang);
  const citations = retrieved.map((r) => `${r.surah}:${r.ayah}`);

  const payload: Record<string, unknown> = {
    ...guidanceResult.guidance,
    citations,
    retrieved,
  };

  if (shouldExposeDebugMeta(env)) {
    payload.meta = {
      llm_used: guidanceResult.llmUsed,
      llm_error: guidanceResult.llmError || null,
      rate_limit: {
        count: rateResult.count,
        max: rateResult.max,
        window_sec: rateResult.windowSec,
      },
    };
  }

  return respond(payload, 200, "ok", {
    llmUsed: guidanceResult.llmUsed,
    llmError: guidanceResult.llmError,
    retrievedCount: retrieved.length,
  });
}
