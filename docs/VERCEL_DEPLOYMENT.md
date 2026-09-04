# Vercel deployment plan

The application can use Neon Postgres and Vercel Blob in production while
retaining SQLite and local uploads for local development.

## Target architecture

- Vite/React frontend: Vercel web service.
- Express API: Vercel Node.js Function (`api/index.js`).
- Relational data: Marketplace Postgres (Neon is the default recommendation).
- Master photos: Vercel Blob or another S3-compatible object store.
- Telegram: HTTPS webhook (`TELEGRAM_MODE=webhook`), not polling.
- Reminders and review requests: Vercel Cron (`REMINDER_MODE=cron`).

## Required production variables

Never copy `server/.env` into Git or expose server variables with a `VITE_`
prefix.

```text
NODE_ENV=production
PUBLIC_APP_URL=https://your-domain.example
CLIENT_ORIGIN=https://your-domain.example
TRUST_PROXY=true
JWT_SECRET=<random, at least 32 characters>
ADMIN_USERNAME=<admin login>
ADMIN_PASSWORD_HASH=<bcrypt hash>
TELEGRAM_BOT_TOKEN=<bot token>
TELEGRAM_BOT_USERNAME=<bot username>
TELEGRAM_MODE=webhook
TELEGRAM_WEBHOOK_SECRET=<random secret>
REMINDER_MODE=cron
CRON_SECRET=<random secret>
AI_PROVIDER=gemini
GEMINI_API_KEY=<server-side key>
GEMINI_MODEL=gemini-3.1-flash-lite
AI_DAILY_REQUEST_LIMIT=100
AI_TIMEOUT_MS=60000
```

Neon supplies `DATABASE_URL`. Vercel Blob supplies `BLOB_READ_WRITE_TOKEN`.
Both must be connected to Production and Preview environments.

## Deployment order

1. Create and connect Marketplace Postgres.
2. Create Blob storage and connect it to the same Vercel project.
3. Add all required environment variables above.
4. Deploy; the build applies the idempotent Postgres schema and seed.
5. Configure a five-minute scheduler request to `/api/integrations/jobs/reminders`.
6. Deploy, set `PUBLIC_APP_URL`, then run `npm run telegram:set-webhook --prefix server`.
7. Test registration, all three roles, booking conflicts, Telegram login,
   reminders, review flow, uploads and rollback.

## Current compatibility

Local Docker remains the reference development environment. It uses SQLite,
a persistent uploads volume, Telegram polling and the in-process reminder
interval. Vercel uses Postgres, Blob, Telegram webhook and an external
scheduler without changing user-facing flows.
