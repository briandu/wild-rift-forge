Import the latest Claude Design handoff (or the zip/path I specify) into this repo and implement it against our stack.

For a later zip that updates screens already in `apps/web`, prefer `/implement-design-update`.

1. Ingest if needed: `npm run design:ingest -- "<zip>" --title "..." --offers "a; b"`
2. Follow `.cursor/skills/import-claude-design/SKILL.md`
3. Target: `apps/web` (Next.js) using `design/STACK.md` + Premium Gaming baseline
4. Versioning: `design/handoffs/vNN-short-slug/` — read `CHANGELOG.md` / `PATCH.md` for what this patch offers. Claude’s zip `(N)` is not the version.
5. Do not ship Claude Design `support.js` to production
6. Diff against the previous `vNN` and only implement the delta

