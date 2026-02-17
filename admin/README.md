# Local Admin Usage Panel (Production D1)

This admin tool is intentionally separate from the main app and is meant to run locally only.

## What it does

- Serves a simple local usage panel on `http://127.0.0.1:8788`
- Connects to production D1 via Wrangler remote execution
- Provides fixed analytics endpoints only:
  - `GET /api/overview` for aggregate usage
  - `GET /api/interactions` for per-request inspection (input/output)

## Run

From `admin/`:

```bash
npm run dev
```

Then open `http://127.0.0.1:8788`.

## Environment variables

- `ADMIN_PORT` (default `8788`)
- `ADMIN_D1_BINDING` (default `DB`)
- `ADMIN_WRANGLER_CONFIG` (default `./wrangler.toml`)

## Notes

- This does not import or reuse the main app code.
- A deploy script exists only to fail intentionally and block deployment.
- You still need valid Wrangler auth locally (`wrangler whoami`).
