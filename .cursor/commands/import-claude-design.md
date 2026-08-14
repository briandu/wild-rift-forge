Import the latest Claude Design handoff (or the zip/path I specify) into this repo and implement it against our stack.

For a later zip that updates screens already in `apps/web`, prefer `/implement-design-update`.

1. Ingest if needed: `npm run design:ingest`
2. Follow `.cursor/skills/import-claude-design/SKILL.md`
3. Target: `apps/web` (Next.js) using `design/STACK.md` + Premium Gaming baseline
4. Do not ship Claude Design `support.js` to production
5. Diff against the previous handoff and only implement the delta

