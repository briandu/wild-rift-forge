-- Persisted LLM reasons for a blended_v1 placement. One row per
-- snapshot + champion + lane + bracket + ruleset. Regenerated only when
-- the evidence hash changes so daily stats syncs do not spend tokens.

CREATE TABLE IF NOT EXISTS tier_explanations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  snapshot_date date NOT NULL,
  champion_id bigint NOT NULL REFERENCES champions (id) ON DELETE CASCADE,
  lane text NOT NULL CHECK (lane IN ('Top', 'Jungle', 'Mid', 'Dragon', 'Support')),
  rank_bracket text NOT NULL CHECK (
    rank_bracket IN ('all', 'diamond_plus', 'master_plus', 'challenger_plus', 'legendary')
  ),
  ruleset text NOT NULL CHECK (ruleset IN ('cn_stats_v1', 'blended_v1')),
  letter text NOT NULL CHECK (letter IN ('S', 'A', 'B', 'C')),
  model text NOT NULL,
  prompt_hash text NOT NULL,
  why text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date, champion_id, lane, rank_bracket, ruleset)
);

COMMENT ON TABLE tier_explanations IS
  'LLM one-liner for why a champion sits in a letter. Keyed to a placement; skipped when prompt_hash matches.';

CREATE INDEX IF NOT EXISTS idx_tier_explanations_lookup
  ON tier_explanations (ruleset, rank_bracket, snapshot_date DESC, lane);
