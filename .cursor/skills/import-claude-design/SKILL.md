---
name: import-claude-design
description: >-
  Ingest a Claude Design .zip (or use the latest design/handoffs slug) and
  implement it into apps/web as Next.js + React + TypeScript, following the
  Wild Rift Forge Premium Gaming baseline and design/STACK.md. Use when the user says
  import Claude Design, /import-claude-design, drops a design zip, or asks to
  build UI from a Claude Design handoff.
---

# Import Claude Design → apps/web

## Trigger

User provides a `.zip` path, a handoff slug, says `/import-claude-design`, or asks to implement the latest Claude Design export.

## Steps

1. **Ingest (if needed)**  
   - If given a zip: `npm run design:ingest -- "<zip>" --slug <optional>`  
   - If `--latest` / “latest download”: `npm run design:ingest -- --latest`  
   - If files already in `design/handoffs/<slug>/` or `design/claude-baseline/`, skip ingest.

2. **Orient**  
   - Read `design/STACK.md`.  
   - Read `design/handoffs/LATEST` (or the named slug) and that folder’s `MANIFEST.json`.  
   - Skim entry `*.dc.html` for screens, IA, tokens (colors, type, layout).  
   - Note which screens are in scope for this request (homepage, counters, profile, draft, states).

3. **Map to stack**  
   - Routes → `apps/web` App Router.  
   - Data → `@wild-rift-forge/game-data` + `apps/api` (scaffold stubs if API not ready).  
   - Images → Supabase `game-assets` public URLs / Next `Image`, not permanent Riot hotlinks.  
   - Styling → project tokens/CSS (create `apps/web` globals/tokens if missing). Extract from the mock: bg `#0B0A12`, accent `#6A5CF0` / `#8E85F5`, Archivo.

4. **Implement**  
   - Build real React components; **never** ship `support.js` or `<x-dc>` runtime.  
   - Preserve Premium Gaming hierarchy (art-led hero, search-first, staged counters).  
   - Wire loading/empty/sparse states when present in the handoff.  
   - Keep diffs focused on the screens asked for.

5. **Verify**  
   - Typecheck / lint touched packages when `apps/web` exists.  
   - Summarize: handoff slug used, routes touched, open questions (missing API, asset gaps).

## Do not

- Reopen design directions 1A / 1C unless the user asks.  
- Invent a different CSS framework mid-handoff if `apps/web` already has one.  
- Commit secrets or treat mock matchup numbers as live stats.  
- Apply DB schema outside migrations.

## User-facing close

State the handoff slug, what was implemented, and what still needs API/data before the screen is production-real.
