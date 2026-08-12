# Wild Rift Forge

Wild Rift strategy, counter, matchup, patch-data, and draft-analysis platform.

## Monorepo layout

```text
apps/
  scraper/    # data ingestion pipeline (patch notes, champions)
  api/        # Express REST API
  web/        # Next.js (App Router) frontend — RIFTLINE
packages/
  database/   # pg client + query helpers
  game-data/  # canonical internal types (Champion, Patch, PatchChange, ...)
design/       # Claude Design handoffs → apps/web (see design/README.md)
supabase/
  migrations/ # SQL migrations, applied via `supabase db push`
```

### Claude Design → Cursor

Visual work lives in Claude Design (Premium Gaming / RIFTLINE). Export a `.zip`, then:

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
npm run dev:web    # Next.js on http://localhost:3000
```

`NEXT_PUBLIC_API_URL` defaults to `http://localhost:4000`. Counter scores are stubbed until a recommendation package exists.

## Scraper

```bash
npm run scrape:latest              # ingest the latest patch if not already stored
npm run scrape:backfill -- --limit 5   # backfill recent patches
npm run scrape:champions -- --limit 5  # sync champion roster (listing + detail pages)
npm run scrape:champion-assets -- --limit 5  # host portraits in Supabase Storage (hash-skip)
npm test                           # parser/normalizer tests against committed fixtures
```

Champion portraits are stored in the `game-assets` Storage bucket. Asset sync
downloads from Riot, SHA-256 hashes the bytes, and uploads only when the hash
changes. Requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env`.

