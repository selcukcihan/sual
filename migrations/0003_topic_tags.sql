CREATE TABLE IF NOT EXISTS topic (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ayah_topic (
  ayah_id INTEGER NOT NULL,
  topic_id INTEGER NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  PRIMARY KEY (ayah_id, topic_id),
  FOREIGN KEY (ayah_id) REFERENCES ayah(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES topic(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ayah_topic_ayah ON ayah_topic (ayah_id);
CREATE INDEX IF NOT EXISTS idx_ayah_topic_topic ON ayah_topic (topic_id);
