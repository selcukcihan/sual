ALTER TABLE ayah ADD COLUMN text_tr TEXT;

CREATE VIRTUAL TABLE IF NOT EXISTS ayah_fts_tr USING fts5(
  text_tr,
  ref UNINDEXED,
  tokenize = 'porter unicode61',
  content = 'ayah',
  content_rowid = 'id'
);

CREATE TRIGGER IF NOT EXISTS ayah_ai_tr AFTER INSERT ON ayah BEGIN
  INSERT INTO ayah_fts_tr(rowid, text_tr, ref)
  VALUES (new.id, coalesce(new.text_tr, ''), printf('%d:%d', new.surah, new.ayah));
END;

CREATE TRIGGER IF NOT EXISTS ayah_ad_tr AFTER DELETE ON ayah BEGIN
  INSERT INTO ayah_fts_tr(ayah_fts_tr, rowid, text_tr, ref)
  VALUES ('delete', old.id, coalesce(old.text_tr, ''), printf('%d:%d', old.surah, old.ayah));
END;

CREATE TRIGGER IF NOT EXISTS ayah_au_tr AFTER UPDATE ON ayah BEGIN
  INSERT INTO ayah_fts_tr(ayah_fts_tr, rowid, text_tr, ref)
  VALUES ('delete', old.id, coalesce(old.text_tr, ''), printf('%d:%d', old.surah, old.ayah));
  INSERT INTO ayah_fts_tr(rowid, text_tr, ref)
  VALUES (new.id, coalesce(new.text_tr, ''), printf('%d:%d', new.surah, new.ayah));
END;

INSERT INTO ayah_fts_tr(rowid, text_tr, ref)
SELECT id, coalesce(text_tr, ''), printf('%d:%d', surah, ayah)
FROM ayah;
