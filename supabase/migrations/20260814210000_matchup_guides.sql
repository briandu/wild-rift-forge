-- Authored lane matchup guides (AI-written, later maybe human-edited).
-- One current row per you/them/lane. This is mutable working copy, not
-- append-only patch history: we overwrite when a kit actually changes.
--
-- Token rule: kit-stable advice (punish windows, trade pattern, mistakes)
-- is reused across patches unless kit_hash changes or a rework/new ability
-- lands. Lane win-rate verdicts stay computed in code and are not stored.

CREATE TABLE IF NOT EXISTS matchup_guides (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  you_champion_id bigint NOT NULL REFERENCES champions (id) ON DELETE CASCADE,
  them_champion_id bigint NOT NULL REFERENCES champions (id) ON DELETE CASCADE,
  lane text NOT NULL CHECK (lane IN ('Top', 'Jungle', 'Mid', 'Dragon', 'Support')),
  patch_version text,
  kit_hash text NOT NULL,
  context_hash text NOT NULL,
  model text NOT NULL,
  prompt_version integer NOT NULL DEFAULT 1,
  one_thing text NOT NULL,
  style text NOT NULL,
  style_pos integer NOT NULL CHECK (style_pos BETWEEN 0 AND 100),
  phases jsonb NOT NULL,
  trades jsonb NOT NULL,
  mistakes jsonb NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (you_champion_id, them_champion_id, lane),
  CHECK (you_champion_id <> them_champion_id)
);

COMMENT ON TABLE matchup_guides IS
  'Current authored matchup copy. Regenerated only when the kit hash changes or a rework lands.';

CREATE INDEX IF NOT EXISTS idx_matchup_guides_lookup
  ON matchup_guides (you_champion_id, them_champion_id, lane);

-- Queue of pairings people opened with no guide yet. The generate job
-- drains this so we only spend tokens on pairs that were actually viewed.

CREATE TABLE IF NOT EXISTS matchup_guide_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  you_champion_id bigint NOT NULL REFERENCES champions (id) ON DELETE CASCADE,
  them_champion_id bigint NOT NULL REFERENCES champions (id) ON DELETE CASCADE,
  lane text NOT NULL CHECK (lane IN ('Top', 'Jungle', 'Mid', 'Dragon', 'Support')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (you_champion_id, them_champion_id, lane),
  CHECK (you_champion_id <> them_champion_id)
);

COMMENT ON TABLE matchup_guide_requests IS
  'Viewed matchup pairings waiting for (or already given) an authored guide.';

CREATE INDEX IF NOT EXISTS idx_matchup_guide_requests_pending
  ON matchup_guide_requests (requested_at)
  WHERE generated_at IS NULL;
