#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const TOPIC_RULES = {
  anger: ["anger", "angry", "restrain", "forgive", "pardon", "lenient", "harsh", "ofke", "öfke", "kizgin", "kızgın", "affet"],
  forgiveness: ["forgive", "forgiveness", "pardon", "overlook", "mercy", "affet", "bagisla", "bağışla", "merhamet"],
  justice: ["justice", "just", "equity", "fair", "witness", "oppress", "wrongdoers", "adalet", "hak", "zulm", "zulüm"],
  patience: ["patience", "patient", "steadfast", "persevere", "hardship", "prayer", "sabir", "sabır", "dua"],
  family: ["family", "parents", "mother", "father", "brother", "sister", "relatives", "kin", "aile", "anne", "baba", "kardes", "kardeş", "akraba"],
  honesty: ["truth", "honest", "falsehood", "lie", "betray", "trust", "dogru", "doğru", "durust", "dürüst", "yalan", "guven", "güven"],
  reconciliation: ["reconcile", "reconciliation", "peace", "settlement", "pardon", "baris", "barış", "uzlas", "uzlaş", "islah", "ıslah"],
};

function sqlEscape(value) {
  return value.replace(/'/g, "''");
}

function buildSql(useExplicitTransaction) {
  const parts = [];
  if (useExplicitTransaction) {
    parts.push("BEGIN TRANSACTION;");
  }
  parts.push("DELETE FROM ayah_topic;");

  for (const topic of Object.keys(TOPIC_RULES)) {
    parts.push(`INSERT OR IGNORE INTO topic (name) VALUES ('${sqlEscape(topic)}');`);
  }

  for (const [topic, terms] of Object.entries(TOPIC_RULES)) {
    const clauses = terms
      .map((term) => `lower(coalesce(a.text_en, '') || ' ' || coalesce(a.text_tr, '')) LIKE '%${sqlEscape(term.toLowerCase())}%'`)
      .join(" OR ");

    parts.push(`
      INSERT OR IGNORE INTO ayah_topic (ayah_id, topic_id, weight)
      SELECT a.id, t.id, 1.0
      FROM ayah a
      JOIN topic t ON t.name = '${sqlEscape(topic)}'
      WHERE ${clauses};
    `);
  }

  if (useExplicitTransaction) {
    parts.push("COMMIT;");
  }
  return parts.join("\n");
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
  const mode = process.argv.includes("--remote") ? "--remote" : "--local";
  const useExplicitTransaction = mode !== "--remote";
  const dbIdx = process.argv.indexOf("--db");
  const dbBinding = dbIdx >= 0 ? process.argv[dbIdx + 1] || "DB" : "DB";

  const outFile = path.resolve(process.cwd(), ".local/tag-ayah-topics.sql");
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, buildSql(useExplicitTransaction), "utf8");

  const env = {
    ...process.env,
    XDG_CONFIG_HOME: path.resolve(process.cwd(), ".local/xdg/config"),
    XDG_STATE_HOME: path.resolve(process.cwd(), ".local/xdg/state"),
    XDG_CACHE_HOME: path.resolve(process.cwd(), ".local/xdg/cache"),
    WRANGLER_LOG_PATH: path.resolve(process.cwd(), ".local/wrangler/wrangler.log"),
    WRANGLER_LOG: "error",
  };

  console.log(`Prepared SQL file: ${outFile}`);
  console.log(`Tagging ayat topics in D1 (${dbBinding}, ${mode})...`);
  await run("npx", ["wrangler", "d1", "execute", dbBinding, mode, "--file", outFile], env);
  console.log("Tagging completed.");
}

main().catch((err) => {
  console.error(err.message || String(err));
  process.exit(1);
});
