CREATE TABLE IF NOT EXISTS ayah (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  surah INTEGER NOT NULL,
  ayah INTEGER NOT NULL,
  text_ar TEXT,
  text_en TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'Sahih International',
  juz INTEGER,
  hizb INTEGER,
  page INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (surah, ayah, source)
);

CREATE INDEX IF NOT EXISTS idx_ayah_ref ON ayah (surah, ayah);
CREATE INDEX IF NOT EXISTS idx_ayah_source ON ayah (source);

CREATE VIRTUAL TABLE IF NOT EXISTS ayah_fts USING fts5(
  text_en,
  ref UNINDEXED,
  tokenize = 'porter unicode61',
  content = 'ayah',
  content_rowid = 'id'
);

CREATE TRIGGER IF NOT EXISTS ayah_ai AFTER INSERT ON ayah BEGIN
  INSERT INTO ayah_fts(rowid, text_en, ref)
  VALUES (new.id, new.text_en, printf('%d:%d', new.surah, new.ayah));
END;

CREATE TRIGGER IF NOT EXISTS ayah_ad AFTER DELETE ON ayah BEGIN
  INSERT INTO ayah_fts(ayah_fts, rowid, text_en, ref)
  VALUES ('delete', old.id, old.text_en, printf('%d:%d', old.surah, old.ayah));
END;

CREATE TRIGGER IF NOT EXISTS ayah_au AFTER UPDATE ON ayah BEGIN
  INSERT INTO ayah_fts(ayah_fts, rowid, text_en, ref)
  VALUES ('delete', old.id, old.text_en, printf('%d:%d', old.surah, old.ayah));
  INSERT INTO ayah_fts(rowid, text_en, ref)
  VALUES (new.id, new.text_en, printf('%d:%d', new.surah, new.ayah));
END;
