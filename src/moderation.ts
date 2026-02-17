import { parsePositiveInt } from "./shared/http";
import type { Env } from "./shared/types";

export type ModerationOutcome = "passed" | "blocked" | "rate_limited_bypass" | "unavailable";

export type ModerationResult = {
  outcome: ModerationOutcome;
  model: string;
  input: string;
  output?: unknown;
  flagged?: boolean;
  error?: string;
  statusCode?: number;
};

export async function moderateQuestionInput(question: string, env: Env): Promise<ModerationResult> {
  const model = (env.OPENAI_MODERATION_MODEL || "omni-moderation-latest").trim();
  const input = question;

  if (!env.OPENAI_API_KEY) {
    return {
      outcome: "unavailable",
      model,
      input,
      error: "OPENAI_API_KEY not configured for moderation",
    };
  }

  const timeoutMs = parsePositiveInt(env.OPENAI_TIMEOUT_MS, 12_000);

  let resp: Response;
  try {
    resp = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model, input }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return {
      outcome: "unavailable",
      model,
      input,
      error: `Moderation request failed or timed out after ${timeoutMs}ms`,
    };
  }

  if (resp.status === 429) {
    const body = await safeJson(resp);
    return {
      outcome: "rate_limited_bypass",
      model,
      input,
      output: body,
      error: "Moderation rate limited",
      statusCode: 429,
    };
  }

  if (!resp.ok) {
    const text = await safeText(resp);
    return {
      outcome: "unavailable",
      model,
      input,
      error: `Moderation HTTP ${resp.status}${text ? `: ${text.slice(0, 300)}` : ""}`,
      statusCode: resp.status,
    };
  }

  const body = await safeJson(resp);
  const flagged = readFlagged(body);

  if (flagged) {
    return {
      outcome: "blocked",
      model,
      input,
      output: body,
      flagged: true,
      statusCode: 200,
    };
  }

  return {
    outcome: "passed",
    model,
    input,
    output: body,
    flagged: false,
    statusCode: 200,
  };
}

function readFlagged(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const typed = body as { results?: Array<{ flagged?: boolean }> };
  const first = typed.results && typed.results[0];
  return Boolean(first && first.flagged === true);
}

async function safeJson(resp: Response): Promise<unknown> {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

async function safeText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}
