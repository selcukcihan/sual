# Sual Quran Agent MVP (Workers + D1)

Single Cloudflare Worker hosting both:
- Web app (`GET /`)
- API (`POST /api/ask`)

The MVP keeps costs low by using:
- D1 (SQLite) for Quran ayah storage
- FTS5 search for retrieval (no vector DB required initially)
- Optional LLM generation (OpenAI) for polished guidance

## Architecture

1. User submits a question in the web UI.
2. Worker extracts keywords and queries D1 FTS (`ayah_fts`).
3. Top ayat are returned with references.
4. If `OPENAI_API_KEY` exists, Worker asks `gpt-4.1-nano` to generate concise guidance from retrieved evidence.
5. If no key is set, a heuristic local response is returned.

## Project files

- `src/index.ts`: Worker routes, retrieval, generation, UI HTML
- `migrations/0001_init.sql`: `ayah` table + FTS + triggers
- `migrations/0002_seed_sample.sql`: starter seed ayat
- `wrangler.toml`: Worker + D1 binding config

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Apply migrations to local D1:

```bash
npm run d1:migrate:local
```

3. Import Quran data into local D1.

Quick sample import:

```bash
npm run d1:import:sample
```

Import your own translation JSON:

```bash
npm run d1:import -- ./path/to/quran.json --local --truncate --source "Sahih International"
```

Or download a full English translation and import:

```bash
npm run data:download:en
npm run d1:import -- data/quran-en.full.json --local --truncate --source "quran-json en"
npm run d1:tag:local
```

Download and import Turkish translation:

```bash
npm run data:download:tr
npm run d1:import:tr
```

Accepted formats:
- JSON array of rows: `{ surah, ayah, text_en|text|translation, source? }`
- JSON with `{ "ayahs": [...] }`
- Nested JSON with `surahs[].verses[]` or `data.surahs[].ayahs[]`
- CSV/TSV with header columns including `surah`, `ayah`, and `text_en|text|translation`

Language import flag:
- `--lang en` writes to `text_en`
- `--lang tr` writes to `text_tr`

4. Set OpenAI key (optional, for LLM answers):

```bash
npx wrangler secret put OPENAI_API_KEY
```

Optional model override:

```bash
npx wrangler secret put OPENAI_MODEL
```

Default model is `gpt-4.1-nano`.

For local `wrangler dev`, you can also place `OPENAI_API_KEY` and `OPENAI_MODEL` in `.env`.
The `npm run dev` script enables dotenv loading for Wrangler.

Turnstile setup (recommended before public exposure):

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Set site key as a Worker variable (non-secret) in `wrangler.toml` or `.env`:

```toml
[vars]
TURNSTILE_SITE_KEY = "your_site_key"
```

Optional safety env vars:
- `APP_ENV=production` to reduce verbose error logging.
- `EXPOSE_DEBUG_META=false` to hide internal meta in API responses.
- `RATE_LIMIT_MAX=30` and `RATE_LIMIT_WINDOW_SEC=60` for per-IP throttling on `/api/ask`.
- `RATE_LIMIT_SALT=...` to hash limiter keys (avoid storing raw IP identifiers in D1).
- `ANON_ID_SECRET=...` to sign anonymous ID cookies and hash request metadata.
- `CACHE_TTL_SEC=1209600` to control D1 guidance response cache TTL (default: 14 days).
- `RETRIEVAL_CACHE_TTL_SEC=604800` to control D1 retrieval cache TTL (default: 7 days).
- `OPENAI_TIMEOUT_MS=15000` to cap upstream OpenAI request latency.
- `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` to enforce bot checks on `/api/ask`.
- `TURNSTILE_EXPECTED_HOSTNAME` and `TURNSTILE_EXPECTED_ACTION` for strict Turnstile verification.
- `ALLOW_INSECURE_LOCAL_BYPASS=true` to bypass Turnstile in local/dev only (ignored in production).
- `ABUSE_CONTROL_ENABLED=true` to enable temporary denylist checks.
- `ABUSE_CONTROL_THRESHOLD=8` to tune the heuristic score that triggers a block.
- `ABUSE_CONTROL_BLOCK_MINUTES=30` to control how long temporary blocks last.
- `ABUSE_CONTROL_LOCAL_BYPASS=true` to keep local/dev traffic unblocked while testing.

5. Run the Worker locally (frontend + API):

```bash
npm run dev
```

6. Deploy:

```bash
npm run deploy
```

## API contract

### `POST /api/ask`

Request:

```json
{
  "question": "I am in conflict with my sibling. How should I respond?"
}
```

Response includes:
- `answer`
- `principles[]` with `citations`
- `actions[]`
- `disclaimer`
- `citations[]`
- `retrieved[]` ayah evidence
- optional `meta` (debug mode only)

## Security notes

- API enforces JSON content type for `/api/ask`.
- API rejects oversized request bodies (`413`) to reduce abuse risk.
- Per-IP rate limiting is stored in D1 (`rate_limit` table).
- Temporary abuse controls can deny obviously automated traffic before retrieval/LLM work.
- Temporary blocks expire automatically and can be bypassed in local/dev with `ABUSE_CONTROL_LOCAL_BYPASS=true`.
