#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

function usage() {
  console.error(
    "Usage: node scripts/import-quran-json.mjs <input.json|input.csv|input.tsv> [--local|--remote] [--db <binding>] [--source <name>] [--lang en|tr] [--truncate]"
  );
}

function sqlEscape(value) {
  return value.replace(/'/g, "''");
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function splitDelimitedLine(line, delimiter) {
  const out = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  out.push(current.trim());
  return out;
}

function parseDelimited(content, delimiter) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = splitDelimitedLine(lines[0], delimiter).map((h) => h.trim().toLowerCase());
  const idxSurah = headers.findIndex((h) => h === "surah" || h === "surah_id" || h === "chapter");
  const idxAyah = headers.findIndex((h) => h === "ayah" || h === "ayah_id" || h === "verse" || h === "verse_id");
  const idxText = headers.findIndex(
    (h) => h === "text_en" || h === "text" || h === "translation" || h === "verse_text"
  );
  const idxSource = headers.findIndex((h) => h === "source" || h === "translation_name");

  if (idxSurah < 0 || idxAyah < 0 || idxText < 0) {
    throw new Error("CSV/TSV must include surah, ayah, and text_en/text/translation columns.");
  }

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitDelimitedLine(lines[i], delimiter);
    rows.push({
      surah: Number(cols[idxSurah]),
      ayah: Number(cols[idxAyah]),
      text_en: cols[idxText] || "",
      source: idxSource >= 0 ? cols[idxSource] : "",
    });
  }
  return rows;
}

function extractRows(parsed) {
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return [];

    if (parsed[0]?.verses && Array.isArray(parsed[0].verses)) {
      const out = [];
      for (const surahObj of parsed) {
        const surahNo = Number(surahObj.id ?? surahObj.surah ?? surahObj.surah_number);
        if (!surahNo || !Array.isArray(surahObj.verses)) continue;
        for (const verse of surahObj.verses) {
          out.push({
            surah: surahNo,
            ayah: Number(verse.id ?? verse.ayah ?? verse.verse),
            text_en: normalizeString(verse.translation ?? verse.text_en ?? verse.text),
            source: normalizeString(verse.source || ""),
          });
        }
      }
      return out;
    }

    return parsed;
  }

  if (Array.isArray(parsed.ayahs)) return parsed.ayahs;

  if (parsed?.data?.surahs && Array.isArray(parsed.data.surahs)) {
    const out = [];
    for (const surahObj of parsed.data.surahs) {
      const surahNo = Number(surahObj.number ?? surahObj.id);
      if (!surahNo || !Array.isArray(surahObj.ayahs)) continue;
      for (const verse of surahObj.ayahs) {
        out.push({
          surah: surahNo,
          ayah: Number(verse.numberInSurah ?? verse.id ?? verse.ayah),
          text_en: normalizeString(verse.text ?? verse.translation ?? verse.text_en),
          source: normalizeString(parsed.data.edition?.englishName || ""),
        });
      }
    }
    return out;
  }

  return [];
}

function run(cmd, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", env });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} failed with code ${code}`));
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    usage();
    process.exit(1);
  }

  const inputPath = args[0];
  let mode = "--local";
  let dbBinding = "DB";
  let forcedSource = "";
  let lang = "en";
  let truncate = false;

  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--local" || arg === "--remote") {
      mode = arg;
      continue;
    }
    if (arg === "--db") {
      dbBinding = args[i + 1] || dbBinding;
      i += 1;
      continue;
    }
    if (arg === "--source") {
      forcedSource = args[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg === "--lang") {
      lang = (args[i + 1] || "en").toLowerCase();
      i += 1;
      continue;
    }
    if (arg === "--truncate") {
      truncate = true;
    }
  }

  if (lang !== "en" && lang !== "tr") {
    throw new Error("Unsupported --lang value. Use 'en' or 'tr'.");
  }

  const absoluteInput = path.resolve(process.cwd(), inputPath);
  const raw = await fs.readFile(absoluteInput, "utf8");

  let rows = [];
  if (absoluteInput.toLowerCase().endsWith(".csv")) {
    rows = parseDelimited(raw, ",");
  } else if (absoluteInput.toLowerCase().endsWith(".tsv")) {
    rows = parseDelimited(raw, "\t");
  } else {
    const parsed = JSON.parse(raw);
    rows = extractRows(parsed);
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Input file must be JSON/CSV/TSV with parseable ayah rows.");
  }

  const sqlParts = [];
  sqlParts.push("BEGIN TRANSACTION;");
  if (truncate) {
    sqlParts.push("DELETE FROM ayah;");
  }

  for (const row of rows) {
    const surah = Number(row.surah ?? row.surah_number ?? row.chapter ?? row.surah_id);
    const ayah = Number(row.ayah ?? row.ayah_number ?? row.verse ?? row.verse_number ?? row.number);
    const textEn = normalizeString(row.text_en ?? row.text ?? row.translation);
    const source = normalizeString(forcedSource || row.source || row.translation_name || "Unknown");

    if (!surah || !ayah || !textEn) {
      continue;
    }

    if (lang === "en") {
      sqlParts.push(
        `INSERT INTO ayah (surah, ayah, text_en, source) VALUES (${surah}, ${ayah}, '${sqlEscape(
          textEn
        )}', '${sqlEscape(source)}')
         ON CONFLICT(surah, ayah, source) DO UPDATE SET text_en = excluded.text_en;`
      );
    } else {
      const textTr = textEn;
      sqlParts.push(
        `UPDATE ayah SET text_tr='${sqlEscape(textTr)}' WHERE surah=${surah} AND ayah=${ayah};`
      );
      sqlParts.push(
        `INSERT INTO ayah (surah, ayah, text_en, text_tr, source)
         SELECT ${surah}, ${ayah}, '${sqlEscape(textTr)}', '${sqlEscape(textTr)}', '${sqlEscape(source)}'
         WHERE NOT EXISTS (SELECT 1 FROM ayah WHERE surah=${surah} AND ayah=${ayah});`
      );
    }
  }

  sqlParts.push("COMMIT;");

  const outFile = path.resolve(process.cwd(), ".local/import-quran.sql");
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, sqlParts.join("\n"), "utf8");

  const env = {
    ...process.env,
    XDG_CONFIG_HOME: path.resolve(process.cwd(), ".local/xdg/config"),
    XDG_STATE_HOME: path.resolve(process.cwd(), ".local/xdg/state"),
    XDG_CACHE_HOME: path.resolve(process.cwd(), ".local/xdg/cache"),
    WRANGLER_LOG_PATH: path.resolve(process.cwd(), ".local/wrangler/wrangler.log"),
    WRANGLER_LOG: "error",
  };

  console.log(`Prepared SQL file: ${outFile}`);
  console.log(`Importing ${rows.length} rows into D1 (${dbBinding}, ${mode})...`);

  await run("npx", ["wrangler", "d1", "execute", dbBinding, mode, "--file", outFile], env);

  console.log("Import completed.");
}

main().catch((err) => {
  console.error(err.message || String(err));
  process.exit(1);
});
