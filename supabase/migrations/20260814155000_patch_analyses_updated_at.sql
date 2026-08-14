-- patch_analyses stays one row per patch. updated_at is set only when
-- commentary is rewritten because the stored patch-note fingerprint changed.
-- Daily win-rate snapshots are not a notes change and must not rewrite the row.

ALTER TABLE patch_analyses
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON TABLE patch_analyses IS
  'LLM commentary for a patch (lede, watch, movers). One row per patch; rewritten only when patch-note facts change. Never writes tier letters.';

COMMENT ON COLUMN patch_analyses.prompt_hash IS
  'SHA-256 of version, title, and stored change lines. Excludes live win rates.';

COMMENT ON COLUMN patch_analyses.updated_at IS
  'Set when commentary is rewritten because the patch-note fingerprint changed.';
