import { JSON_HEADERS, SECURITY_HEADERS } from "./constants";
import type { Env } from "./types";

export function json(payload: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...SECURITY_HEADERS,
      ...(extraHeaders || {}),
    },
  });
}

export function isJsonRequest(request: Request): boolean {
  const contentType = request.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("application/json");
}

export function getClientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

export function isProduction(env: Env): boolean {
  return (env.APP_ENV || "").toLowerCase() === "production";
}

export function shouldExposeDebugMeta(env: Env): boolean {
  if (isProduction(env)) {
    return (env.EXPOSE_DEBUG_META || "").toLowerCase() === "true";
  }
  return true;
}

export function parsePositiveInt(value: string | undefined, fallbackValue: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallbackValue;
  return Math.floor(n);
}
