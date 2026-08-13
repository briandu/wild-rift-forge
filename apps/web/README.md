# apps/web

Next.js (App Router) + React + TypeScript frontend for **Wild Rift Forge**.

Visual source of truth is Claude Design under `design/handoffs/` (Premium Gaming). Implement handoffs as real React — do not ship `support.js` or `<x-dc>`.

## Dev

From the repo root (API must be running for live champion data):

```bash
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:3001
```

Optional env (copy into `apps/web/.env.local`):

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Auth uses Supabase (email/password, Google, Apple). In the dashboard, set Site URL to
`http://localhost:3001`, add `http://localhost:3001/auth/callback` under Redirect URLs,
and enable Google / Apple under Authentication → Providers. Riot and Discord are hidden
until those providers are ready.

For a real roster and hosted art: start local Postgres (`node scripts/dev-db.mjs`), apply migrations, then `npm run scrape:champions` / `npm run scrape:champion-assets`. Without a DB, the UI uses a small local demo roster and stub counter scores.

## Routes

| Path | Status |
| --- | --- |
| `/` | Homepage search + hero |
| `/counters/[champion]` | Counter results (lane win-rate gaps from CN stats) |
| `/champions/[slug]` | Profile + live matchup table |
| `/matchups` | Pair picker + lane stats (authored Garen/Darius copy kept) |
| `/draft` | Interactive lobby; suggestions from pool + tier stats |
| `/login` | Sign in / sign up (Supabase) |
| `/me` | Account: avatar, pool, saved matchups, settings |
