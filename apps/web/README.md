# apps/web

Next.js (App Router) + React + TypeScript frontend for **RIFTLINE**.

Visual source of truth is Claude Design under `design/handoffs/` (Premium Gaming). Implement handoffs as real React — do not ship `support.js` or `<x-dc>`.

## Dev

From the repo root (API must be running for live champion data):

```bash
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:3000
```

Optional env (defaults shown):

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

For a real roster and hosted art: start local Postgres (`node scripts/dev-db.mjs`), apply migrations, then `npm run scrape:champions` / `npm run scrape:champion-assets`. Without a DB, the UI uses a small local demo roster and stub counter scores.

## Routes

| Path | Status |
| --- | --- |
| `/` | Homepage search + hero |
| `/counters/[champion]` | Counter results (stub scores via API) |
| `/champions/[slug]` | Profile stub |
| `/draft` | Draft stub |
