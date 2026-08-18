# v14 — Draft board live states

- **Ingested:** 2026-08-17T22:15:27.540Z
- **Legacy folder:** —
- **Claude download name:** Champion-art plan update (12).zip
- **Archived zip:** `source.zip` (gitignored) / `wrf-design-v14-draft-board-live-states.zip`

## Offers

- Draft board: role icons, pre-pick state, phase badge, elapsed timer, YOU marker, first pick, delete
- Capture: calibrated preview, calibrating spinner, manual override
- Sessions: shareable link, account history, screenshot/video store
- Enemy possible lanes

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

- Live draft board (desktop + mobile): role glyphs, YOU badge, first-pick mark, pre-pick state, phase badge, elapsed + phase clocks, per-slot delete, Fix / manual override.
- Enemy slots show inferred lanes from the current tier snapshot (pick-rate mix, FLEX when split). Champion select still does not expose their roles.
- SCREEN READ panel: last captured frame, calibrating spinner, region summary. Frames stay on-device until the owner ends a signed-in session.
- Spectator link at `/draft/s/[token]`. Previous sessions list on Ready and Account, with a screenshot stored for 30 days.
- Left alone: emails, champion-list / matchup direction canvases, homepage / counters chrome, Pro gate copy.
