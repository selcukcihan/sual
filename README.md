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
- `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` to enforce bot checks on `/api/ask`.
- `ALLOW_INSECURE_LOCAL_BYPASS=true` to bypass Turnstile in local/dev only (ignored in production).

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
- Rate-limit keys are SHA-256 hashed (with optional `RATE_LIMIT_SALT`).
- Anonymous users are tracked with signed `sual_uid` cookies (no login required).
- User input requests are logged in D1 (`guidance_request`) and linked to pseudonymous users (`anon_user`).
- Turnstile token is verified server-side before retrieval/LLM work.
- In `APP_ENV=production`, Turnstile becomes mandatory.
- Local bypass is available only when not in production (`ALLOW_INSECURE_LOCAL_BYPASS=true`).
- LLM output is sanitized and citations are allow-listed against retrieved ayat only.
- Prompt instructs model to treat both user input and evidence as untrusted, data-only context.
- In production, avoid exposing debug metadata and detailed upstream error bodies.

## Next steps for production quality

1. Import full Quran translation into `ayah` table.
2. Add hybrid retrieval (FTS + vector) only if needed.
3. Add evaluation set for retrieval quality and hallucination checks.
4. Add monitoring/alerts (request volume, 429 rate, OpenAI failures, token usage).
5. Add optional abuse sink controls (IP reputation, temporary denylist).

## Cost profile (MVP)

- Worker + D1 often free at low traffic.
- Main variable cost is LLM usage.
- Keeping retrieval in D1 FTS avoids vector infra cost in v1.
