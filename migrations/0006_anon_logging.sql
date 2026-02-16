CREATE TABLE IF NOT EXISTS anon_user (
  anon_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  first_ip_hash TEXT,
  first_user_agent_hash TEXT,
  last_ip_hash TEXT,
  last_user_agent_hash TEXT,
  request_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS guidance_request (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anon_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  lang TEXT NOT NULL,
  question_text TEXT NOT NULL,
  status TEXT NOT NULL,
  http_status INTEGER NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  llm_used INTEGER,
  llm_error TEXT,
  retrieved_count INTEGER,
  FOREIGN KEY (anon_id) REFERENCES anon_user (anon_id)
);

CREATE INDEX IF NOT EXISTS idx_guidance_request_anon_created
ON guidance_request (anon_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guidance_request_created
ON guidance_request (created_at DESC);
