CREATE TABLE IF NOT EXISTS abuse_control (
  id TEXT PRIMARY KEY,
  ip TEXT NOT NULL,
  reason TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_abuse_control_expires_at ON abuse_control (expires_at);
CREATE INDEX IF NOT EXISTS idx_abuse_control_ip_expires_at ON abuse_control (ip, expires_at);
