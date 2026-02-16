import { MAX_BODY_BYTES, MAX_QUESTION_CHARS } from "../shared/constants";
import { json, isJsonRequest, shouldExposeDebugMeta } from "../shared/http";
import { generateGuidance } from "../guidance";
import { retrieveAyat } from "../retrieval";
import { applyRateLimit, verifyTurnstile } from "../security";
import type { Env } from "../shared/types";

export async function handleAsk(request: Request, env: Env): Promise<Response> {
  if (!isJsonRequest(request)) {
    return json({ error: "content-type must be application/json" }, 415);
  }
  const declaredSize = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES) {
    return json({ error: `Request body exceeds ${MAX_BODY_BYTES} bytes` }, 413);
  }

  const rateResult = await applyRateLimit(request, env);
  if (!rateResult.allowed) {
    return json(
      {
        error: "Rate limit exceeded. Please retry shortly.",
      },
      429,
      {
        "retry-after": String(rateResult.retryAfterSec),
      }
    );
  }

  let question = "";
  let lang = "tr";
  let turnstileToken = "";

  try {
    const body = (await request.json()) as { question?: string; lang?: string; turnstileToken?: string };
    question = (body.question || "").trim();
    lang = body.lang === "en" ? "en" : "tr";
    turnstileToken = (body.turnstileToken || "").trim();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!question) {
    return json({ error: "Question is required" }, 400);
  }
  if (question.length > MAX_QUESTION_CHARS) {
    return json({ error: `Question exceeds ${MAX_QUESTION_CHARS} characters` }, 400);
  }
  question = question.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  const turnstileResult = await verifyTurnstile(turnstileToken, request, env);
  if (!turnstileResult.ok) {
    const statusCode = turnstileResult.statusCode || 403;
    return json(
      { error: turnstileResult.message || "Turnstile verification failed." },
      statusCode
    );
  }

  const retrieved = await retrieveAyat(env.DB, question, 8, lang);

  if (retrieved.length === 0) {
    return json({
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
    });
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

  return json(payload);
}
