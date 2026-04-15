export interface Env {
  DB: D1Database;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_MODERATION_MODEL?: string;
  OPENAI_TIMEOUT_MS?: string;
  CACHE_TTL_SEC?: string;
  RETRIEVAL_CACHE_TTL_SEC?: string;
  APP_ENV?: string;
  EXPOSE_DEBUG_META?: string;
  RATE_LIMIT_MAX?: string;
  RATE_LIMIT_WINDOW_SEC?: string;
  RATE_LIMIT_SALT?: string;
  ANON_ID_SECRET?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_EXPECTED_HOSTNAME?: string;
  TURNSTILE_EXPECTED_ACTION?: string;
  ALLOW_INSECURE_LOCAL_BYPASS?: string;
  ABUSE_CONTROL_ENABLED?: string;
  ABUSE_CONTROL_THRESHOLD?: string;
  ABUSE_CONTROL_BLOCK_MINUTES?: string;
  ABUSE_CONTROL_LOCAL_BYPASS?: string;
}

export type AyahRow = {
  id: number;
  surah: number;
  ayah: number;
  text_en: string;
  source: string;
  score?: number;
};

export type GuidanceResponse = {
  answer: string;
  principles: Array<{ name: string; explanation: string; citations: string[] }>;
  actions: string[];
  disclaimer: string;
};

export type GuidanceResult = {
  guidance: GuidanceResponse;
  llmUsed: boolean;
  llmError?: string;
};
