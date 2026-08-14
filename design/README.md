# Design handoffs (Claude Design → Cursor)

Claude Design is the ongoing visual source. Cursor implements into `apps/web` (Next.js). Exports are **references**, not drop-in app code.

## Loop

1. Design in [claude.ai/design](https://claude.ai/design) using [`STACK.md`](./STACK.md) as the product/stack brief.
2. Export a `.zip` (Share / Export), or drop the download path into chat.
3. Ingest into the repo:

```bash
npm run design:ingest -- "C:/Users/Brian Du/Downloads/Your Export.zip"
# optional slug:
npm run design:ingest -- "./my.zip" --slug counters-v2
```

4. In Cursor: `/implement-design-update` (incremental zip) or `/import-claude-design` (first import).
5. Agent translates layout, tokens, and IA into `apps/web` against real data types / API — not by copying `support.js`.

## Layout

```text
design/
  STACK.md                 # paste into Claude Design
  README.md                # this file
  handoffs/
    <slug>/                # one folder per export
      MANIFEST.json        # written by ingest
      *.dc.html            # Claude Design canvases
      support.js           # design runtime (preview only)
      uploads/             # splash / portrait refs
```

Current baseline (Premium Gaming + next screens):

`design/handoffs/2026-08-11-champion-art-plan/`

An earlier unpack may also exist at `design/claude-baseline/` — prefer the `handoffs/` copy going forward.

## Preview a handoff locally

```bash
npm run design:preview -- 2026-08-11-champion-art-plan
# then open http://127.0.0.1:8765/
```

## What Cursor must / must not do

| Do | Don’t |
| --- | --- |
| Map screens → App Router routes + React components | Commit `support.js` into `apps/web` |
| Extract colors/type/spacing into CSS variables | Hotlink Riot CDN long-term (use `game-assets`) |
| Wire UI to `@wild-rift-forge/game-data` + API | Treat mock win rates as real data |
| Keep Premium Gaming visual language | Reopen rejected directions 1A / 1C |

## Optional later

- Anthropic “Send to Claude Code” handoff URLs can be pasted in chat; ingest still lands under `design/handoffs/`.
- Third-party MCP bridges exist; this repo uses a **project-native** ingest + skill so the loop works before `apps/web` is scaffolded.
