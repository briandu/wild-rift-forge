# Wild Rift Forge

Wild Rift strategy, counter, matchup, patch-data, and draft-analysis platform.

## Monorepo layout

```text
apps/
  scraper/    # data ingestion pipeline (patch notes, champions)
  api/        # Express REST API
  web/        # Next.js (App Router) frontend — Wild Rift Forge
packages/
  database/   # pg client + query helpers
  game-data/  # canonical internal types (Champion, Patch, PatchChange, ...)
design/       # Claude Design handoffs → apps/web (see design/README.md)
research/
  android/    # APK/APKM investigation (see research/android/README.md)
data/         # versioned champion gameplay baseline (see data/README.md)
docs/data/    # baseline schema notes
supabase/
  migrations/ # SQL migrations, applied via `supabase db push`
```

### Claude Design → Cursor

Visual work lives in Claude Design (Premium Gaming / Wild Rift Forge). Export a `.zip`, then:

```bash
npm run design:ingest -- "C:/Users/Brian Du/Downloads/Your Export.zip"
# In Cursor: /import-claude-design
```

Pasteable stack brief for Claude Design: [`design/STACK.md`](design/STACK.md).

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and set `SUPABASE_DB_URL`.

### Local dev database (no Supabase project needed)

```bash
node scripts/dev-db.mjs          # starts embedded Postgres on port 5544 (keep running)
node scripts/apply-migrations.mjs # applies supabase/migrations/*.sql locally
```

`.env` default: `postgresql://postgres:postgres@localhost:5544/wild_rift_forge`

### Supabase (production)

Create a project at supabase.com, put its connection string in `.env`, link with
`npx supabase link`, and apply migrations with `npx supabase db push` (the only
approved method for the remote — see `.cursor/rules/supabase.mdc`).

## Web + API

```bash
npm run dev:api    # Express on http://localhost:4000
npm run dev:web    # Next.js on http://localhost:3001
```

`NEXT_PUBLIC_API_URL` defaults to `http://localhost:4000`. Counter scores are stubbed until a recommendation package exists. On Vercel, omit `NEXT_PUBLIC_API_URL` and set `SUPABASE_DB_URL` so the web app reads Postgres directly.

Web auth (email/password, Google, Apple) needs `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `apps/web/.env.local`. On the hosted
Supabase project, Site URL must be `https://www.wildriftforge.com` (not
localhost). Redirect URLs should include that origin and `http://localhost:*/**`
so local OAuth returns to whatever port `next dev` is using:

```bash
SUPABASE_ACCESS_TOKEN=sbp_... node scripts/configure-auth-urls.mjs
```

Google Cloud authorized JavaScript origins: `http://localhost`,
`https://www.wildriftforge.com`, and `https://wildriftforge.com`. The Authorized
redirect URI is the Supabase callback
(`https://<project-ref>.supabase.co/auth/v1/callback`), not the app path.
Identity linking (email then Google) is a dashboard toggle.

Branded auth email HTML needs custom SMTP (Resend is the usual path):

```bash
node scripts/configure-resend-smtp.mjs
node scripts/push-auth-email-templates.mjs
```

Riot Sign-On is optional (`RIOT_CLIENT_ID` / `RIOT_CLIENT_SECRET`). Until that
exists, users can save a `Summoner#TAG` on `/me`. Weekly digest:

```bash
node scripts/send-weekly-digest.mjs --dry-run
```

## Deploy (Vercel)

The Next.js app lives in `apps/web`. Vercel Root Directory must be `apps/web`
(install runs from the repo root via `apps/web/vercel.json`).

Required environment variables:

- `SUPABASE_DB_URL` — Supabase **session pooler** URI (server-only)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — account deletion + digest (server-only)

After the first production URL exists, add `https://<domain>/auth/callback` to
Supabase Authentication → Redirect URLs and set Site URL to that domain.

Pushes to `master` deploy production once the GitHub repo is connected in Vercel.

From the repo root, after `npx vercel login`:

```bash
node scripts/publish-site.mjs
```

## Scraper

```bash
npm run scrape:latest              # ingest the latest patch if not already stored
npm run scrape:backfill -- --limit 5   # backfill recent patches
npm run scrape:champions -- --limit 5  # sync roster + detail (roles, skins, abilities)
npm run scrape:champion-assets -- --limit 5  # host portraits in Supabase Storage (hash-skip)
npm run scrape:champion-thumbnails -- --limit 200  # WildRiftFire face-crops → Storage
npm run scrape:stats               # Tencent CN win/pick/ban → snapshots + tier bands
npm run scrape:analyze-patch       # ChatGPT commentary for a newly ingested patch (optional)
npm test                           # parser/normalizer tests against committed fixtures
```

GitHub Actions [Check for patch updates](https://github.com/briandu/wild-rift-forge/actions/workflows/check-patch.yml)
runs `scrape:latest` every 6 hours (`17 */6 * * *`). That job only ingests Riot patch
notes into `patches` / `patch_changes`. It does not compute the tier list. A separate
daily workflow runs `scrape:stats` (Tencent CN Diamond+ rates → S/A/B/C). After a *new*
patch insert, the patch workflow also runs `scrape:analyze-patch` when `OPENAI_API_KEY`
is set — commentary only, never letter grades.

CI must use the Supabase **session pooler** URI (`SUPABASE_DB_URL` secret). GitHub
runners cannot reach the IPv6-only `db.*.supabase.co` host.

Champion portraits are stored in the `game-assets` Storage bucket. Asset sync
downloads from Riot, SHA-256 hashes the bytes, and uploads only when the hash
changes. Requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env`.

