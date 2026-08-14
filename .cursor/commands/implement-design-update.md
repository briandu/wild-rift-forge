# Implement design update

Apply a Claude Design **update** (zip or already-ingested handoff) to the live `apps/web` UI.

Use this for incremental exports like `Champion-art plan update (N).zip`. For a first-time import of a new product surface, `/import-claude-design` is fine — then follow this command for later zips.

## 1. Ingest

If the user gave a `.zip` path:

```bash
npm run design:ingest -- "<zip-path>"
```

If they said “latest” / no path:

```bash
npm run design:ingest -- --latest
```

Skip ingest when files are already under `design/handoffs/<slug>/`.

Read `design/handoffs/LATEST` and that folder’s `MANIFEST.json`.

## 2. Diff the delta

Compare the new slug to the **previous** handoff (the `LATEST` value before ingest, or the next-newest `design/handoffs/20*` folder).

- List new / removed files (especially a new canvas like `Lane Glyphs.dc.html`).
- `diff` product HTML that actually changed: prefer `Wild Rift Forge.dc.html` and `Wild Rift Forge Mobile.dc.html`.
- Ignore noise: emails, directions canvases, `support.js`, and files whose visible copy did not change.
- If a directions canvas explores options (1A / 1B / 3A…), implement the **chosen** set — gold/highlighted or the one the copy calls “yours” / “use this”. Do not ship every exploration.

## 3. Map and implement

Follow `.cursor/skills/import-claude-design/SKILL.md`, `design/STACK.md`, and `.cursor/rules/claude-design-handoff.mdc`.

This command **is** permission to change already-built screens **when the zip updates those screens**. It is not permission to restyle unrelated UI or invent a new look.

- Translate into Next.js + existing tokens/components. Never ship `support.js` or `<x-dc>`.
- Reuse live components (`LaneGlyph`, `AbilityTip`, chip rows, etc.) instead of one-off mock markup.
- Wire real `@wild-rift-forge/game-data` / API shapes. Do not treat mock WR / pick rates as facts.
- Keep Premium Gaming tokens (`#0B0A12`, cyan `#16C0FF` / `#7FDCFF`, Archivo).
- Schema only via `supabase/migrations/` + `npx supabase db push` for remote.

## 4. Leave alone

- Screens whose HTML/copy did not change vs the previous handoff.
- Email HTML unless the user asked for email.
- Visual “improvements” not in the delta.

## 5. Verify and close

- Typecheck / lint touched `apps/web` files. Add or extend unit tests for new pure helpers.
- Recap: handoff slug, what Claude changed, what landed in the app, what was left alone, and any API/data gaps.
