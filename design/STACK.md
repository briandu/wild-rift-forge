# Stack brief for Claude Design

Paste this (or link the repo context) into Claude Design when starting a new screen so mockups stay implementable in Cursor.

## Product

- **Working name in UI:** RIFTLINE (Wild Rift companion — counters, matchups, draft, patch)
- **Repo:** `wild-rift-forge` monorepo
- **Chosen visual direction:** Premium Gaming (direction 1B) — dark Discord-adjacent base, Archivo display, purple accent, full-bleed champion art, search-first homepage, staged counter results

## Implementation stack (do not invent alternatives)

| Layer | Choice |
| --- | --- |
| Frontend | Next.js (App Router) + React + TypeScript in `apps/web` |
| API | Express + TypeScript in `apps/api` |
| Data | PostgreSQL via Supabase; schema only through `supabase/migrations/` |
| Types | `@wild-rift-forge/game-data` (Champion, Patch, …) |
| Champion images | Hosted in Supabase Storage bucket `game-assets` (scraped + hashed); UI uses public URLs / Next Image, not hotlinked Riot assets long-term |
| Scraper | `apps/scraper` — not part of the UI surface |

## Design constraints that keep handoffs cheap

1. **Desktop-first 1240px frames are fine**; also sketch mobile for homepage + counter results when the screen is primary.
2. Prefer **real product surfaces** over marketing fluff: homepage search, counter results, champion profile, draft assistant, empty/loading/sparse-data states.
3. **Art leads, numbers support** — one primary recommendation can dominate; dense tables are secondary.
4. Use **CSS variables / named tokens** in notes when possible (`--bg`, `--accent`, `--text-muted`) so Cursor can map to `apps/web` globals.
5. Do **not** assume auth, billing, or social feed unless asked.
6. Copy and IA can say RIFTLINE; routes will live under `apps/web` (e.g. `/`, `/counters/[champion]`, `/champions/[slug]`, `/draft`).
7. Avoid shipping production JS frameworks inside the design — Claude Design’s `.dc.html` + `support.js` runtime is expected; Cursor will rewrite to Next.js components.

## Baseline already locked

- Homepage + counter results: Premium Gaming language
- Next screens roughed: champion profile, draft assistant, empty/loading/sparse/patch-just-landed states
- Accent: ~`#6A5CF0` / `#8E85F5` on `#0B0A12`
- Type: Archivo (display + UI)

When iterating, **extend this direction** — do not reopen 1A (dense analytics) or 1C (command palette) unless the product owner asks.
