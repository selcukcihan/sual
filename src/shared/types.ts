export interface Env {
  DB: D1Database;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  APP_ENV?: string;
  EXPOSE_DEBUG_META?: string;
  RATE_LIMIT_MAX?: string;
  RATE_LIMIT_WINDOW_SEC?: string;
  RATE_LIMIT_SALT?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
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
