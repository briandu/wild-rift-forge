# WildRift Forge

Wild Rift strategy, counter, matchup, patch-data, and draft-analysis platform.

## Monorepo layout

```text
apps/
  scraper/    # data ingestion pipeline (patch notes, champions)
  api/        # (placeholder) Express REST API
  web/        # (placeholder) Next.js frontend
packages/
  database/   # pg client + query helpers
  game-data/  # canonical internal types (Champion, Patch, PatchChange, ...)
supabase/
  migrations/ # SQL migrations, applied via `supabase db push`
```

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and set `SUPABASE_DB_URL`.

### Local dev database (no Supabase project needed)

```bash
node scripts/dev-db.mjs          # starts embedded Postgres on port 5544 (keep running)
node scripts/apply-migrations.mjs # applies supabase/migrations/*.sql locally
```

`.env` default: `postgresql://postgres:postgres@localhost:5544/wildrift_forge`

### Supabase (production)

Create a project at supabase.com, put its connection string in `.env`, link with
`npx supabase link`, and apply migrations with `npx supabase db push` (the only
approved method for the remote — see `.cursor/rules/supabase.mdc`).

## Scraper

```bash
npm run scrape:latest              # ingest the latest patch if not already stored
npm run scrape:backfill -- --limit 5   # backfill recent patches
npm run scrape:champions -- --limit 5  # sync champion roster (listing + detail pages)
npm test                           # parser/normalizer tests against committed fixtures
```
