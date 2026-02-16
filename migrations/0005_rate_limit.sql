CREATE TABLE IF NOT EXISTS rate_limit (
  id TEXT PRIMARY KEY,
  ip TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_expires_at ON rate_limit (expires_at);
