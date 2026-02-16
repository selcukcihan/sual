CREATE TABLE IF NOT EXISTS guidance_cache (
  cache_key TEXT PRIMARY KEY,
  question_norm TEXT NOT NULL,
  lang TEXT NOT NULL,
  model TEXT NOT NULL,
  cache_version TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  last_hit_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_guidance_cache_expires_at ON guidance_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_guidance_cache_created_at ON guidance_cache (created_at DESC);
