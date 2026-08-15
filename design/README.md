# Design handoffs (Claude Design → Cursor)

Claude Design is the ongoing visual source. Cursor implements into `apps/web` (Next.js). Exports are **references**, not drop-in app code.

## Versioning

Claude’s download names reset (`Champion-art plan update (3).zip`) and collide with older exports. **Do not use that name as identity.**

| Thing | Scheme |
| --- | --- |
| Handoff folder | `design/handoffs/vNN-short-slug/` |
| Zip (Downloads + `source.zip` in the folder) | `wrf-design-vNN-short-slug.zip` |
| What each patch offers | [`handoffs/CHANGELOG.md`](./handoffs/CHANGELOG.md) and each folder’s `PATCH.md` |
| Machine catalog | [`handoffs/INDEX.json`](./handoffs/INDEX.json) |

`source.zip` is gitignored. Unpacked canvases stay in git.

## Loop

1. Design in [claude.ai/design](https://claude.ai/design) using [`STACK.md`](./STACK.md) as the product/stack brief.
2. Export a `.zip` (Share / Export), or drop the download path into chat.
3. Ingest (assigns the next `vNN`, archives the zip, updates the changelog):

```bash
npm run design:ingest -- "C:/Users/brian/Downloads/Champion-art plan update (3).zip" \
  --title "Loading states and item art" \
  --slug loading-states \
  --offers "Adds Loading States canvas.; Specs pending / stale / empty / failed."
```

`--latest` picks the newest matching zip in Downloads. Always pass `--title` and `--offers` so `PATCH.md` / `CHANGELOG.md` stay accurate.

4. In Cursor: `/implement-design-update` (incremental zip) or `/import-claude-design` (first import).
5. Agent translates layout, tokens, and IA into `apps/web` against real data types / API — not by copying `support.js`.

## Layout

```text
design/
  STACK.md                 # paste into Claude Design
  README.md                # this file
  handoffs/
    CHANGELOG.md           # what each vNN offers
    INDEX.json             # machine-readable catalog
    LATEST                 # current slug
    vNN-short-slug/
      PATCH.md             # this patch’s offers
      MANIFEST.json
      source.zip           # gitignored archive
      *.dc.html
```

Current latest: `design/handoffs/v12-loading-states/` (see `handoffs/LATEST`).

An earlier unpack may also exist at `design/claude-baseline/` — prefer the versioned `handoffs/` copy.

## Preview a handoff locally

```bash
npm run design:preview -- v12-loading-states
# then open http://127.0.0.1:8765/
```

## What Cursor must / must not do

| Do | Don’t |
| --- | --- |
| Map screens → App Router routes + React components | Commit `support.js` into `apps/web` |
| Extract colors/type/spacing into CSS variables | Hotlink Riot CDN long-term (use `game-assets`) |
| Wire UI to `@wild-rift-forge/game-data` + API | Treat mock win rates as real data |
| Keep Premium Gaming visual language | Reopen rejected directions 1A / 1C |
| Diff against the previous `vNN` and implement the delta | Use Claude’s `(N)` zip number as the version |
