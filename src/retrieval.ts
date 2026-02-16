import type { AyahRow } from "./shared/types";

export async function retrieveAyat(db: D1Database, question: string, limit: number, lang: string): Promise<AyahRow[]> {
  const baseKeywords = extractKeywords(question);
  const keywords = expandKeywords(baseKeywords);
  const ftsQuery = toFtsQuery(keywords);
  const queryTopics = detectQueryTopics(question, baseKeywords);
  if (!ftsQuery) {
    return [];
  }

  const ftsTable = lang === "tr" ? "ayah_fts_tr" : "ayah_fts";
  const textField = lang === "tr" ? "coalesce(a.text_tr, a.text_en)" : "a.text_en";
  const ftsSql = `
    SELECT a.id, a.surah, a.ayah, ${textField} AS text_en, a.source, bm25(${ftsTable}, 10.0, 1.0) AS score
    FROM ${ftsTable}
    JOIN ayah a ON a.id = ${ftsTable}.rowid
    WHERE ${ftsTable} MATCH ?
    ORDER BY score ASC
    LIMIT ?
  `;

  const candidatePoolSize = Math.max(40, limit * 10);
  const fts = await db.prepare(ftsSql).bind(ftsQuery, candidatePoolSize).all<AyahRow>();
  let rows = fts.results || [];

  if (rows.length === 0 && keywords.length > 0) {
    const likeTerm = `%${keywords[0]}%`;
    const likeField = lang === "tr" ? "coalesce(text_tr, text_en)" : "text_en";
    const likeSql = `
      SELECT id, surah, ayah, ${likeField} AS text_en, source
      FROM ayah
      WHERE lower(${likeField}) LIKE lower(?)
      LIMIT ?
    `;
    const fallback = await db.prepare(likeSql).bind(likeTerm, limit).all<AyahRow>();
    rows = fallback.results || [];
  }

  const deduped = dedupeByRef(rows);
  const ayahTopics = await fetchAyahTopics(db, deduped.map((r) => r.id));
  return rerankCandidates(question, baseKeywords, deduped, limit, queryTopics, ayahTopics);
}

function extractKeywords(input: string): string[] {
  const stop = new Set([
    "the",
    "and",
    "for",
    "that",
    "with",
    "from",
    "this",
    "what",
    "when",
    "where",
    "which",
    "would",
    "should",
    "could",
    "about",
    "into",
    "your",
    "have",
    "will",
    "they",
    "them",
    "their",
    "there",
    "been",
    "were",
    "than",
    "then",
    "just",
    "want",
    "help",
    "need",
  ]);

  return input
    .toLowerCase()
    .replace(/[^a-z0-9çğıöşü\s]/gi, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !stop.has(t))
    .slice(0, 10);
}

function expandKeywords(keywords: string[]): string[] {
  const synonyms: Record<string, string[]> = {
    angry: ["anger", "restrain", "pardon", "forgive"],
    anger: ["restrain", "pardon", "forgive"],
    sibling: ["family", "kinship", "reconcile", "pardon"],
    conflict: ["dispute", "reconcile", "peace"],
    justice: ["fair", "equity"],
    patience: ["patient", "steadfast"],
    ofke: ["sabir", "affet", "bagisla", "yumusak"],
    öfke: ["sabır", "affet", "bağışla", "yumuşak"],
    kizgin: ["sabir", "affet", "bagisla"],
    kızgın: ["sabır", "affet", "bağışla"],
    adalet: ["hak", "esitlik", "insaf", "eşitlik"],
    aile: ["anne", "baba", "kardes", "kardeş", "akraba"],
    tartisma: ["uzlas", "baris", "islah"],
    tartışma: ["uzlaş", "barış", "ıslah"],
    sabir: ["dua", "dayan", "metanet"],
    sabır: ["dua", "dayan", "metanet"],
  };

  const out = new Set<string>(keywords);
  for (const key of keywords) {
    const extra = synonyms[key] || [];
    for (const item of extra) {
      out.add(item);
    }
  }
  return Array.from(out).slice(0, 20);
}

function toFtsQuery(keywords: string[]): string {
  if (keywords.length === 0) {
    return "";
  }

  return keywords
    .map((t) => t.toLowerCase().replace(/[^a-z0-9çğıöşü]/gi, ""))
    .filter((t) => t.length > 1)
    .map((t) => `${t}*`)
    .join(" OR ");
}

function dedupeByRef(rows: AyahRow[]): AyahRow[] {
  const seen = new Set<string>();
  const out: AyahRow[] = [];
  for (const row of rows) {
    const key = `${row.surah}:${row.ayah}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(row);
  }
  return out;
}

function rerankCandidates(
  question: string,
  baseKeywords: string[],
  rows: AyahRow[],
  limit: number,
  queryTopics: Set<string>,
  ayahTopics: Map<number, Set<string>>
): AyahRow[] {
  const questionTokens = tokenize(question);
  const ethicalHints = getEthicalHints(baseKeywords, questionTokens);
  const legalIntent = hasLegalIntent(questionTokens);

  const scored = rows.map((row) => ({
    row,
    score: scoreCandidate(row, questionTokens, ethicalHints, legalIntent, queryTopics, ayahTopics.get(row.id)),
  }));

  scored.sort((a, b) => b.score - a.score);

  const chosen: AyahRow[] = [];
  const usedSurah = new Map<number, number>();

  for (const item of scored) {
    if (chosen.length >= limit) break;
    const surahHits = usedSurah.get(item.row.surah) || 0;
    if (surahHits >= 2) continue;
    chosen.push(item.row);
    usedSurah.set(item.row.surah, surahHits + 1);
  }

  if (chosen.length < limit) {
    for (const item of scored) {
      if (chosen.length >= limit) break;
      if (!chosen.find((r) => r.surah === item.row.surah && r.ayah === item.row.ayah)) {
        chosen.push(item.row);
      }
    }
  }

  return chosen;
}

function scoreCandidate(
  row: AyahRow,
  questionTokens: Set<string>,
  ethicalHints: Set<string>,
  legalIntent: boolean,
  queryTopics: Set<string>,
  rowTopics?: Set<string>
): number {
  const textTokens = tokenize(row.text_en);
  const overlap = intersectionSize(questionTokens, textTokens);
  const hintOverlap = intersectionSize(ethicalHints, textTokens);
  const topicOverlap = rowTopics ? intersectionSize(queryTopics, rowTopics) : 0;
  const textLength = row.text_en.length;
  const brevityPenalty = textLength > 450 ? 0.4 : 0;
  const longPenalty = textLength > 700 ? 0.7 : 0;
  const ftsBonus = typeof row.score === "number" ? Math.max(0, -row.score) * 0.08 : 0;
  const topicBoost = topicOverlap * 3.4;
  const legalPenalty = !legalIntent && containsLegalFamilyTerms(textTokens) ? 2.2 : 0;
  const personalAngerQuery = questionTokens.has("angry") || questionTokens.has("anger");
  const punitivePenalty = personalAngerQuery && containsPunitiveAngerContext(textTokens) ? 1.8 : 0;
  const divineWrathPenalty = personalAngerQuery && containsDivineWrathPattern(textTokens) ? 2.5 : 0;
  return (
    overlap * 3.2 +
    hintOverlap * 2.4 +
    topicBoost +
    ftsBonus -
    brevityPenalty -
    longPenalty -
    legalPenalty -
    punitivePenalty -
    divineWrathPenalty
  );
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9çğıöşü\s]/gi, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const t of a) {
    if (b.has(t)) count += 1;
  }
  return count;
}

function getEthicalHints(baseKeywords: string[], questionTokens: Set<string>): Set<string> {
  const hints = new Set<string>();

  const dictionary: Record<string, string[]> = {
    angry: ["anger", "forgive", "pardon", "restrain", "patience"],
    conflict: ["reconcile", "peace", "justice", "forgive"],
    sibling: ["brother", "sister", "family", "kinship"],
    justice: ["just", "equity", "fairness", "witness"],
    lie: ["truth", "falsehood", "honest"],
    dishonest: ["truth", "honest", "trust"],
    money: ["charity", "spend", "wealth", "measure"],
    hardship: ["patience", "prayer", "steadfast"],
    ofke: ["affet", "bagisla", "sabir", "yumusak"],
    öfke: ["affet", "bağışla", "sabır", "yumuşak"],
    adalet: ["hak", "insaf", "esitlik", "eşitlik"],
    aile: ["anne", "baba", "kardes", "kardeş", "akraba"],
    tartisma: ["uzlas", "baris", "islah"],
    tartışma: ["uzlaş", "barış", "ıslah"],
  };

  for (const key of baseKeywords) {
    const extras = dictionary[key] || [];
    for (const e of extras) hints.add(e);
  }

  if (
    questionTokens.has("angry") ||
    questionTokens.has("anger") ||
    questionTokens.has("ofke") ||
    questionTokens.has("öfke") ||
    questionTokens.has("kizgin") ||
    questionTokens.has("kızgın")
  ) {
    hints.add("forgive");
    hints.add("pardon");
    hints.add("restrain");
    hints.add("affet");
    hints.add("bagisla");
    hints.add("bağışla");
    hints.add("sabir");
    hints.add("sabır");
  }
  if (questionTokens.has("justice") || questionTokens.has("fair") || questionTokens.has("adalet")) {
    hints.add("just");
    hints.add("equity");
    hints.add("hak");
    hints.add("insaf");
  }

  return hints;
}

function detectQueryTopics(question: string, baseKeywords: string[]): Set<string> {
  const text = `${question} ${baseKeywords.join(" ")}`.toLowerCase();
  const topics = new Set<string>();

  const rules: Record<string, string[]> = {
    anger: ["anger", "angry", "rage", "temper", "upset"],
    forgiveness: ["forgive", "forgiveness", "pardon", "overlook"],
    justice: ["justice", "just", "fair", "oppress", "equity"],
    patience: ["patience", "patient", "hardship", "persevere"],
    family: ["family", "parent", "mother", "father", "sibling", "brother", "sister"],
    honesty: ["honest", "truth", "lie", "false", "betray", "trust"],
    reconciliation: ["reconcile", "peace", "conflict", "dispute", "fight"],
    anger_tr: ["ofke", "öfke", "kizgin", "kızgın", "hiddet"],
    forgiveness_tr: ["affet", "bagisla", "bağışla", "merhamet"],
    justice_tr: ["adalet", "hak", "zulm", "zulüm", "haksiz", "haksız"],
    patience_tr: ["sabir", "sabır", "dayan", "dua", "zorluk"],
    family_tr: ["aile", "anne", "baba", "kardes", "kardeş", "akraba"],
    honesty_tr: ["dogru", "doğru", "durust", "dürüst", "yalan", "ihanet", "guven", "güven"],
    reconciliation_tr: ["uzlas", "uzlaş", "baris", "barış", "islah", "ıslah", "anlasmazlik", "anlaşmazlık", "kavga"],
  };

  for (const topic in rules) {
    const terms = rules[topic];
    if (terms.some((term) => text.includes(term))) {
      topics.add(topic);
    }
  }

  return topics;
}

async function fetchAyahTopics(db: D1Database, ayahIds: number[]): Promise<Map<number, Set<string>>> {
  const map = new Map<number, Set<string>>();
  if (ayahIds.length === 0) return map;

  const placeholders = ayahIds.map(() => "?").join(", ");
  const sql = `
    SELECT at.ayah_id, t.name
    FROM ayah_topic at
    JOIN topic t ON t.id = at.topic_id
    WHERE at.ayah_id IN (${placeholders})
  `;

  type Row = { ayah_id: number; name: string };
  const result = await db.prepare(sql).bind(...ayahIds).all<Row>();
  const rows = result.results || [];

  for (const row of rows) {
    const bucket = map.get(row.ayah_id) || new Set<string>();
    bucket.add(row.name);
    map.set(row.ayah_id, bucket);
  }

  return map;
}

function hasLegalIntent(tokens: Set<string>): boolean {
  const legalTerms = new Set([
    "marriage",
    "divorce",
    "inheritance",
    "inherit",
    "ruling",
    "fiqh",
    "legal",
    "law",
    "zakat",
    "riba",
    "nikah",
    "nikâh",
    "bosanma",
    "boşanma",
    "miras",
    "hukuk",
    "fetva",
  ]);
  for (const t of tokens) {
    if (legalTerms.has(t)) return true;
  }
  return false;
}

function containsLegalFamilyTerms(tokens: Set<string>): boolean {
  const legalFamilyTerms = new Set([
    "inherit",
    "inheritance",
    "wives",
    "marriage",
    "daughters",
    "sons",
    "mother",
    "fathers",
    "sisters",
    "brother",
    "guardianship",
    "bequest",
    "debt",
    "miras",
    "evlilik",
    "esler",
    "eşler",
    "kizlar",
    "kızlar",
    "ogullar",
    "oğullar",
    "anne",
    "baba",
    "kardes",
    "kardeş",
    "vasiyet",
    "borc",
    "borç",
  ]);
  for (const t of tokens) {
    if (legalFamilyTerms.has(t)) return true;
  }
  return false;
}

function containsPunitiveAngerContext(tokens: Set<string>): boolean {
  const terms = ["cursed", "hell", "disbelievers", "polytheist", "penalty", "taghut", "apes", "pigs"];
  for (const t of terms) {
    if (tokens.has(t)) return true;
  }
  return false;
}

function containsDivineWrathPattern(tokens: Set<string>): boolean {
  const hasAllah = tokens.has("allah");
  const hasAnger = tokens.has("angry") || tokens.has("anger");
  const hasPracticalEthics = tokens.has("forgive") || tokens.has("pardon") || tokens.has("restrain");
  return hasAllah && hasAnger && !hasPracticalEthics;
}

export async function getAyatByIds(db: D1Database, ids: number[], lang: string): Promise<AyahRow[]> {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const cleanIds = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)));
  if (cleanIds.length === 0) return [];

  const placeholders = cleanIds.map(() => "?").join(", ");
  const textField = lang === "tr" ? "coalesce(text_tr, text_en)" : "text_en";
  const sql = `
    SELECT id, surah, ayah, ${textField} AS text_en, source
    FROM ayah
    WHERE id IN (${placeholders})
  `;

  const result = await db.prepare(sql).bind(...cleanIds).all<AyahRow>();
  const rows = result.results || [];
  const byId = new Map<number, AyahRow>(rows.map((r) => [r.id, r]));
  return cleanIds.map((id) => byId.get(id)).filter((row): row is AyahRow => !!row);
}
