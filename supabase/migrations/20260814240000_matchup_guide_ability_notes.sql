-- Tactical ability reads for authored matchup guides.
-- These are play instructions (cue / consequence / the play), not kit dumps.
-- Empty array on existing rows until the next prompt-version refresh.

ALTER TABLE matchup_guides
  ADD COLUMN IF NOT EXISTS ability_notes jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN matchup_guides.ability_notes IS
  '4–6 ability interaction rows: own, k, when, then, win, note. Written from the you seat.';
