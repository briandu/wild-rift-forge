# Smart Commit

Follow the commit conventions in [`.cursor/rules/commits.mdc`](../rules/commits.mdc). Testing mandates: [`.cursor/rules/testing.mdc`](../rules/testing.mdc).

## 1. Analyze Changes

- Run `git status`, `git diff`, and `git diff --cached`.
- Identify **logical groupings** (schema, types, scraper feature, tests, docs, rules). Do not mix unrelated changes in a single commit.

## 2. Cleanup (MANDATORY)

- Scan every modified file for temporary debug code:
  - `console.log(...)`, `console.debug(...)`, `console.info(...)` used for debugging (keep intentional job logging)
  - `debugger`, commented-out debug/test code
- Remove any such code before staging.

## 3. Secret and .gitignore Scan (MANDATORY)

- Scan staged content for secrets — NEVER commit:
  - `postgres://` / `postgresql://` connection strings with real credentials
  - Supabase keys, JWTs (`eyJ...`), API keys (`sk-`, `ghp_`, `AKIA`, `sk_live_`, etc.)
  - `.env` file contents pasted into code
- Verify `.gitignore` covers `.env`, `node_modules/`, `dist/`, `.local/`.
- Note: `apps/scraper/fixtures/*.html` ARE committed intentionally.

## 4. Test Validation (MANDATORY)

- Run **`npm test`** before staging changes that touch scraper parsers, normalizers, validators, or packages.
- New/changed parser, normalizer, or pure-utility logic MUST include or extend tests in the same change unless the user explicitly scoped tests out.
- Report test results in the grouping analysis (e.g. `Tests: 14 passed, 0 failed`).
- **BLOCKER**: If ANY test fails, notify the user and **STOP**. Do not commit unless the user explicitly gives the go-ahead after seeing failures.
- Docs/config/rules-only changes: skip tests only when the diff is strictly non-code.

## 5. Commit Message Format

Conventional Commits:

```
<type>(<scope>): <description>
```

- **Types**: `feat` | `fix` | `docs` | `style` | `refactor` | `perf` | `test` | `chore` | `ci` | `schema`
- **Scopes**: `scraper`, `db`, `game-data`, `parser`, `normalizer`, `jobs`, `api`, `web`, `tests`, `rules`
- Imperative, present tense, lowercase description (~50 chars when possible; max 72).
- Body bullets consecutive with **NO blank lines** between them.
- NEVER use multiple `-m` flags. Use a single heredoc:

```bash
git commit -m "$(cat <<'EOF'
feat(parser): handle accordion blades in old patch layouts

- Parse articleRichTextAccordion groups into rich-text sections
- Add patch 5.0 fixture covering the accordion layout
EOF
)"
```

## 6. Categorize & Commit

- One commit per logical group; stage only that group's files.
- Order: schema/migrations → core utilities/types → feature code → tests → docs/rules.
- After each commit, check `git log -1 --format=%B` for a `Made-with: Cursor` trailer; amend to strip it if present.

## 7. Verify

- Run `git status` and `git log --oneline -5`.
- End state: clean working tree, or only intentional untracked/gitignored files.
- Do **NOT** push unless explicitly requested.

---

**Summary**: Analyze → remove debug → scan secrets → run tests (block on failure) → group by intent → one Conventional Commit per group → strip Cursor trailer → verify.
