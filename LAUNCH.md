# Production Launch Runbook

This runbook is for launching `sual-quran-agent` safely to production.

## 1. Preconditions

- You are on the correct git commit/branch.
- You are authenticated with the correct Cloudflare account.
- Required env/secrets are set for production.

## 2. Required Production Configuration

Set these values before launch:

- `OPENAI_API_KEY` (secret)
- `OPENAI_MODEL` (optional, defaults to `gpt-4.1-nano`)
- `APP_ENV=production`
- `EXPOSE_DEBUG_META=false`
- `RATE_LIMIT_MAX` (e.g. `30`)
- `RATE_LIMIT_WINDOW_SEC` (e.g. `60`)
- `RATE_LIMIT_SALT` (strong random secret)
- `ANON_ID_SECRET` (strong random secret)
- `CACHE_TTL_SEC` (e.g. `1209600`)
- `RETRIEVAL_CACHE_TTL_SEC` (e.g. `604800`)
- `OPENAI_TIMEOUT_MS` (e.g. `15000`)
- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY` (secret)
- `TURNSTILE_EXPECTED_HOSTNAME` (your production host, e.g. `sual.selcukcihan.com`)
- `TURNSTILE_EXPECTED_ACTION=ask_guidance`
- `ALLOW_INSECURE_LOCAL_BYPASS=false` (or unset)

## 3. Pre-Launch Checks (Local)

1. Install dependencies:
```bash
npm install
```

2. Typecheck:
```bash
npm run check
```

3. Confirm migration files exist up to latest:
```bash
ls -1 migrations
```

## 4. Apply Remote Database Migrations

```bash
npm run d1:migrate:remote
```

## 5. Backfill Remote Quran Data

Run in this order:

```bash
npm run d1:import:en:remote
npm run d1:import:tr:remote
npm run d1:tag:remote
```

## 6. Deploy

```bash
npm run deploy
```

## 7. Post-Deploy Verification

1. Health endpoint:
```bash
curl -i https://<your-domain>/health
```
Expect: `200` and `{ "ok": true, ... }`.

2. UI loads:
- Open `https://<your-domain>/`
- Open `https://<your-domain>/about`
- Confirm language switch works and persists.

3. Turnstile + ask flow:
- Submit one Turkish query and one English query.
- Confirm guidance returns without console/runtime errors.

4. Rate limiting:
- Send repeated requests quickly.
- Confirm `429` appears after threshold and includes `retry-after`.

5. Logging/identity:
- Confirm `sual_uid` cookie exists.
- Confirm new rows in `guidance_request` and `anon_user`.

## 8. Quick Troubleshooting

- Always getting “could not find relevant ayat”:
  - Check remote `ayah` and `text_tr` counts; likely data/backfill issue.
- `/api/ask` returns `500`:
  - Usually missing migration; rerun `npm run d1:migrate:remote`.
- Turnstile failures:
  - Verify `TURNSTILE_EXPECTED_HOSTNAME` and `TURNSTILE_EXPECTED_ACTION`.

## 9. Rollback Strategy

1. Keep previous known-good commit hash.
2. Redeploy previous commit:
```bash
git checkout <previous-good-commit>
npm run deploy
```

## 10. Launch Sign-off Checklist

- [ ] `npm run check` passed
- [ ] Remote migrations applied
- [ ] EN/TR data backfilled remotely
- [ ] Topic tags applied remotely
- [ ] Production deploy complete
- [ ] `/health` verified
- [ ] Turkish + English guidance verified
- [ ] Turnstile verified in production
- [ ] Rate limiting verified
- [ ] Logging tables receiving traffic
- [ ] Debug metadata disabled in production
