# v13 — Save gate + Pro draft

- **Ingested:** 2026-08-17T18:00:01.057Z
- **Legacy folder:** —
- **Claude download name:** Champion-art plan update (12).zip
- **Archived zip:** `source.zip` (gitignored) / `wrf-design-v13-product-ui-update.zip`

## Offers

- Desktop product canvas adds a **Save this matchup** auth gate: splash header, three benefits, create-account / sign-in, return-here copy.
- `/draft` is restaged into three states: **Forge Pro gate**, **Ready when the lobby is**, and the live board. Live pick scoring is positioned as Pro.
- Mobile product canvas, emails, and direction studies are unchanged vs v12.

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

- Applied: unsigned **Save matchup** opens the gate instead of dumping to `/login`. Sign up / sign in return to the pair and finish the save.
- Applied: `/draft` shows the Pro gate for Free. A non-empty local board still resumes so an in-progress lobby is not stranded. Ready + live stay wired for Pro / Squad once a plan exists.
- Plan copy: draft assistant moved off Free onto Pro. Upgrade is still waitlist — no card form, no invented live-scoring numbers.
- Left alone: mobile draft sheet, emails, champion list / matchup direction canvases, already-applied homepage / counters / profile chrome.
