# apps/api

Express + TypeScript REST API for `@wild-rift-forge/web`.

## Dev

```bash
# From repo root — loads SUPABASE_DB_URL from .env
npm run dev:api
```

Listens on `http://localhost:4000` (`API_PORT` to override).

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/health` | Liveness |
| `GET` | `/champions` | Roster from Postgres (`listChampions`) |
| `GET` | `/champions/:slug` | Single champion |
| `GET` | `/counters/:slug` | **Stub** matchup payload for UI (not live ranked facts) |
| `GET` | `/tiers` | Latest S/A/B/C placements (`?lane=&bracket=diamond_plus`) |
| `GET` | `/patches/latest` | Latest patch notes + optional LLM commentary |
| `GET` | `/matchups` | Lane rates + kit text; authored guide when stored (`?you=&them=&lane=`) |

If the database is unavailable, `/champions` returns `[]` and `/counters/:slug` still returns stub scores with a synthetic enemy name.
