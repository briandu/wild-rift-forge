# v12 — Loading states and item art

- **Ingested:** 2026-08-15T16:01:37.696Z
- **Legacy folder:** —
- **Claude download name:** Champion-art plan update (3).zip
- **Archived zip:** `source.zip` (gitignored) / `wrf-design-v12-loading-states.zip`

## Offers

- Adds Loading States canvas: one sweep primitive (1.4s), three depths, 300ms show / 400ms hold, mapped onto six surfaces (tier rows, counter cards, coach, mobile picks, search, matchup hero).
- Specs four non-skeleton states: pending action, stale-while-refresh, empty, failed.
- Adds ASSETS-NEEDED.md (runes, items, abilities, splash inventory).
- Adds Garen and Darius ability icons plus 10 item icons for the matchup-rail / builds mock — do not invent live builds from these.

## Canvases

- `Champion List Directions.dc.html`
- `Draft Layout Ideas.dc.html`
- `Email - Password Reset.html`
- `Email - Weekly Digest.html`
- `Email - Welcome.html`
- `Lane Glyphs.dc.html`
- `Loading States.dc.html`
- `Matchup Page Directions.dc.html`
- `Riftline - Next Screens.dc.html`
- `Wild Rift Forge Mobile.dc.html`
- `Wild Rift Forge.dc.html`
- `WildRift Directions.dc.html`

## Implement

- Loading spec is already live in `apps/web`: `[data-skel]` sweep, `useDelayedReveal` (300ms / 400ms), `LoadState` (pending / refresh / empty / failed), and surface skeletons (tier, counters, search, matchup hero, profile, coach).
- Applied: `/items` catalog with handoff icons, stats, passives, and “built most by” portraits. Desktop nav **Items**. Profile Builds tab lists catalog items that name that champion. No mock win rates.
- Applied: Skill order tab (max-order row, 15-col grid, first-three rail) plus local Garen / Darius / Gwen ability art. Grid stays empty — the canvas max order is not a live source.
- Applied: Free / Pro / Squad pricing on `/upgrade` and Account → Plan. Pro / Squad CTA is the waitlist until billing exists. No card-checkout form.
- `ASSETS-NEEDED.md` is a design-side inventory. Production art stays in Supabase `game-assets`. Do not invent item / rune builds from the mock icons.
