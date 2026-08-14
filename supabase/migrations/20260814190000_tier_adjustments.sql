-- Bounded GPT-5.6 Sol letter moves. One row per patch cycle + champion + lane.
-- Daily stats rebuilds apply these without calling OpenAI again.

CREATE TABLE IF NOT EXISTS tier_adjustments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cycle_key text NOT NULL,
  ruleset text NOT NULL CHECK (ruleset IN ('cn_stats_v1', 'blended_v1')),
  champion_id bigint NOT NULL REFERENCES champions (id) ON DELETE CASCADE,
  lane text NOT NULL CHECK (lane IN ('Top', 'Jungle', 'Mid', 'Dragon', 'Support')),
  delta integer NOT NULL CHECK (delta IN (-1, 1)),
  letter_before text NOT NULL CHECK (letter_before IN ('S', 'A', 'B', 'C')),
  letter_after text NOT NULL CHECK (letter_after IN ('S', 'A', 'B', 'C')),
  reason text NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  model text NOT NULL,
  prompt_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_key, ruleset, champion_id, lane)
);

COMMENT ON TABLE tier_adjustments IS
  'Sol ±1 letter moves for a patch cycle. Reapplied on every blended_v1 rebuild until the next review hash.';

CREATE INDEX IF NOT EXISTS idx_tier_adjustments_cycle
  ON tier_adjustments (cycle_key, ruleset);
