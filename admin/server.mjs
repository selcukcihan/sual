import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

const HOST = "127.0.0.1";
const PORT = Number(process.env.ADMIN_PORT || 8788);
const WRANGLER_CONFIG = process.env.ADMIN_WRANGLER_CONFIG || join(process.cwd(), "wrangler.toml");
const DB_BINDING = process.env.ADMIN_D1_BINDING || "DB";

const htmlPath = join(process.cwd(), "public", "index.html");

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

    if (req.method === "GET" && url.pathname === "/") {
      const html = await readFile(htmlPath, "utf8");
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(html);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/overview") {
      const hours = clampInt(url.searchParams.get("hours"), 24, 1, 24 * 30);
      return sendJson(res, 200, await getOverview(hours));
    }

    if (req.method === "GET" && url.pathname === "/api/interactions") {
      const page = clampInt(url.searchParams.get("page"), 1, 1, 2000);
      const pageSize = clampInt(url.searchParams.get("pageSize"), 25, 5, 100);
      const hours = clampInt(url.searchParams.get("hours"), 168, 1, 24 * 365);
      return sendJson(res, 200, await getInteractions({ page, pageSize, hours }));
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
})
  .listen(PORT, HOST, () => {
    console.log(`[admin] listening on http://${HOST}:${PORT}`);
    console.log(`[admin] production D1 binding: ${DB_BINDING}`);
  });

async function getOverview(hours) {
  const sinceSec = nowSec() - hours * 3600;

  const summaryRows = await queryRows(`
    SELECT
      COUNT(*) AS total_requests,
      COUNT(DISTINCT anon_id) AS unique_users,
      COUNT(DISTINCT ip_hash) AS unique_ip_hashes,
      COUNT(DISTINCT user_agent_hash) AS unique_user_agents,
      SUM(CASE WHEN llm_used = 1 THEN 1 ELSE 0 END) AS llm_used_requests,
      SUM(CASE WHEN llm_error = 'LLM output failed citation/shape validation' THEN 1 ELSE 0 END) AS llm_validation_failures,
      SUM(CASE WHEN http_status >= 400 THEN 1 ELSE 0 END) AS error_requests,
      SUM(CASE WHEN status = 'rate_limited' THEN 1 ELSE 0 END) AS rate_limited_requests
    FROM guidance_request
    WHERE created_at >= ${sinceSec}
  `);

  const langRows = await queryRows(`
    SELECT lang, COUNT(*) AS count
    FROM guidance_request
    WHERE created_at >= ${sinceSec}
    GROUP BY lang
    ORDER BY count DESC
  `);

  const statusRows = await queryRows(`
    SELECT status, COUNT(*) AS count
    FROM guidance_request
    WHERE created_at >= ${sinceSec}
    GROUP BY status
    ORDER BY count DESC
    LIMIT 10
  `);

  const hourlyRows = await queryRows(`
    SELECT strftime('%Y-%m-%d %H:00:00', created_at, 'unixepoch') AS hour,
           COUNT(*) AS count
    FROM guidance_request
    WHERE created_at >= ${sinceSec}
    GROUP BY hour
    ORDER BY hour ASC
  `);

  const dailyRows = await queryRows(`
    SELECT date(created_at, 'unixepoch') AS day,
           COUNT(*) AS count,
           COUNT(DISTINCT anon_id) AS unique_users
    FROM guidance_request
    WHERE created_at >= ${nowSec() - 14 * 24 * 3600}
    GROUP BY day
    ORDER BY day ASC
  `);

  const diversityRows = await queryRows(`
    WITH window_users AS (
      SELECT DISTINCT anon_id
      FROM guidance_request
      WHERE created_at >= ${sinceSec}
    )
    SELECT
      (SELECT COUNT(*) FROM window_users) AS active_users,
      (SELECT COUNT(*) FROM anon_user WHERE first_seen_at >= ${sinceSec}) AS new_users,
      (SELECT COUNT(*) FROM window_users wu
       JOIN anon_user au ON au.anon_id = wu.anon_id
       WHERE au.first_seen_at < ${sinceSec}) AS returning_users
  `);

  const topUsersRows = await queryRows(`
    SELECT anon_id, COUNT(*) AS request_count, MAX(created_at) AS last_seen_at
    FROM guidance_request
    WHERE created_at >= ${sinceSec}
    GROUP BY anon_id
    ORDER BY request_count DESC
    LIMIT 10
  `);

  const summary = summaryRows[0] || {};
  const diversity = diversityRows[0] || {};

  return {
    ok: true,
    generatedAtSec: nowSec(),
    windowHours: hours,
    summary: {
      totalRequests: toInt(summary.total_requests),
      uniqueUsers: toInt(summary.unique_users),
      uniqueIpHashes: toInt(summary.unique_ip_hashes),
      uniqueUserAgents: toInt(summary.unique_user_agents),
      llmUsedRequests: toInt(summary.llm_used_requests),
      llmValidationFailures: toInt(summary.llm_validation_failures),
      errorRequests: toInt(summary.error_requests),
      rateLimitedRequests: toInt(summary.rate_limited_requests),
    },
    diversity: {
      activeUsers: toInt(diversity.active_users),
      newUsers: toInt(diversity.new_users),
      returningUsers: toInt(diversity.returning_users),
    },
    byLanguage: langRows.map((r) => ({ lang: String(r.lang || "unknown"), count: toInt(r.count) })),
    byStatus: statusRows.map((r) => ({ status: String(r.status || "unknown"), count: toInt(r.count) })),
    hourlyUsage: hourlyRows.map((r) => ({ hour: String(r.hour || ""), count: toInt(r.count) })),
    dailyUsage14d: dailyRows.map((r) => ({ day: String(r.day || ""), count: toInt(r.count), uniqueUsers: toInt(r.unique_users) })),
    topUsers: topUsersRows.map((r) => ({
      anonId: String(r.anon_id || ""),
      requestCount: toInt(r.request_count),
      lastSeenAtSec: toInt(r.last_seen_at),
    })),
  };
}

async function getInteractions({ page, pageSize, hours }) {
  const sinceSec = nowSec() - hours * 3600;
  const offset = (page - 1) * pageSize;

  const countRows = await queryRows(`
    SELECT COUNT(*) AS total
    FROM guidance_request
    WHERE created_at >= ${sinceSec}
  `);

  const rows = await queryRows(`
    SELECT
      id,
      anon_id,
      created_at,
      lang,
      status,
      http_status,
      question_text,
      llm_used,
      llm_error,
      retrieved_count,
      response_json,
      moderation_status,
      moderation_flagged,
      moderation_input,
      moderation_output,
      moderation_error
    FROM guidance_request
    WHERE created_at >= ${sinceSec}
    ORDER BY created_at DESC
    LIMIT ${pageSize}
    OFFSET ${offset}
  `);

  return {
    ok: true,
    generatedAtSec: nowSec(),
    windowHours: hours,
    page,
    pageSize,
    total: toInt(countRows[0]?.total),
    rows: rows.map((r) => {
      const parsed = parseResponsePayload(r.response_json);
      return {
        id: toInt(r.id),
        anonId: String(r.anon_id || ""),
        createdAtSec: toInt(r.created_at),
        lang: String(r.lang || ""),
        status: String(r.status || ""),
        httpStatus: toInt(r.http_status),
        questionText: String(r.question_text || ""),
        llmUsed: r.llm_used === 1,
        llmError: r.llm_error ? String(r.llm_error) : null,
        retrievedCount: r.retrieved_count === null || r.retrieved_count === undefined ? null : toInt(r.retrieved_count),
        moderationStatus: r.moderation_status ? String(r.moderation_status) : null,
        moderationFlagged: r.moderation_flagged === 1,
        moderationInput: r.moderation_input ? String(r.moderation_input) : null,
        moderationOutput: parseResponsePayload(r.moderation_output),
        moderationError: r.moderation_error ? String(r.moderation_error) : null,
        outputText: extractOutputText(parsed),
        outputRaw: parsed,
      };
    }),
  };
}

function parseResponsePayload(value) {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return { parseError: true, raw: value };
  }
}

function extractOutputText(payload) {
  if (!payload || typeof payload !== "object") return "";
  const answer = typeof payload.answer === "string" ? payload.answer : "";
  if (!answer) return "";

  const actions = Array.isArray(payload.actions)
    ? payload.actions.filter((a) => typeof a === "string").slice(0, 5)
    : [];

  if (actions.length === 0) return answer;
  return `${answer}\n\nActions:\n- ${actions.join("\n- ")}`;
}

async function queryRows(sql) {
  const raw = await runD1Query(sql);
  const statements = normalizeStatements(raw);
  const first = statements[0] || {};
  const rows = first.results;
  return Array.isArray(rows) ? rows : [];
}

async function runD1Query(sql) {
  const args = [
    "wrangler",
    "d1",
    "execute",
    DB_BINDING,
    "--remote",
    "--config",
    WRANGLER_CONFIG,
    "--command",
    sql,
    "--json",
  ];

  try {
    const { stdout } = await execFileAsync("npx", args, {
      maxBuffer: 20 * 1024 * 1024,
      env: process.env,
    });
    return JSON.parse(stdout);
  } catch (err) {
    const stderr = err && typeof err === "object" && "stderr" in err ? String(err.stderr || "") : "";
    const stdout = err && typeof err === "object" && "stdout" in err ? String(err.stdout || "") : "";
    throw new Error((stderr || stdout || String(err)).trim() || "Failed to execute D1 query.");
  }
}

function normalizeStatements(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.result)) return raw.result;
  if (raw && raw.results && Array.isArray(raw.results)) return [raw];
  return [];
}

function clampInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}
