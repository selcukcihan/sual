export const MAX_QUESTION_CHARS = 1200;
export const MAX_BODY_BYTES = 8 * 1024;
export const MAX_ANSWER_CHARS = 2200;
export const MAX_ACTIONS = 8;
export const MAX_PRINCIPLES = 8;
export const GUIDANCE_CACHE_VERSION = "v1";
export const RETRIEVAL_CACHE_VERSION = "v1";

export const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
export const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" };
export const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "cache-control": "no-store",
};

export const HOME_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://challenges.cloudflare.com https://cloudflareinsights.com; img-src 'self' data:; frame-src https://challenges.cloudflare.com;";
