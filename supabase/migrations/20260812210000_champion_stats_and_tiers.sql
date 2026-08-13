-- Daily Tencent CN ranked snapshots, computed tier placements, and LLM patch commentary.
-- Snapshots and analyses are append-only. Placements are rebuilt from the latest snapshot.

CREATE TABLE IF NOT EXISTS champion_stat_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  snapshot_date date NOT NULL,
  champion_id bigint NOT NULL REFERENCES champions (id) ON DELETE CASCADE,
  lane text NOT NULL CHECK (lane IN ('Top', 'Jungle', 'Mid', 'Dragon', 'Support')),
  rank_bracket text NOT NULL CHECK (
    rank_bracket IN ('all', 'diamond_plus', 'master_plus', 'challenger_plus', 'legendary')
  ),
  win_rate numeric(6, 3) NOT NULL,
  pick_rate numeric(6, 3) NOT NULL,
  ban_rate numeric(6, 3) NOT NULL,
  tencent_strength integer,
  tencent_strength_level integer,
  source_url text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date, champion_id, lane, rank_bracket)
);

COMMENT ON TABLE champion_stat_snapshots IS
  'Daily win/pick/ban snapshots from Tencent CN ranked stats. Never overwrite a day once stored.';

CREATE INDEX IF NOT EXISTS idx_champion_stat_snapshots_lookup
  ON champion_stat_snapshots (rank_bracket, snapshot_date DESC, lane);

CREATE TABLE IF NOT EXISTS champion_tier_placements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  snapshot_date date NOT NULL,
  champion_id bigint NOT NULL REFERENCES champions (id) ON DELETE CASCADE,
  lane text NOT NULL CHECK (lane IN ('Top', 'Jungle', 'Mid', 'Dragon', 'Support')),
  rank_bracket text NOT NULL CHECK (
    rank_bracket IN ('all', 'diamond_plus', 'master_plus', 'challenger_plus', 'legendary')
  ),
  letter text NOT NULL CHECK (letter IN ('S', 'A', 'B', 'C')),
  score numeric(8, 4) NOT NULL,
  rank_in_lane integer NOT NULL,
  win_rate numeric(6, 3) NOT NULL,
  pick_rate numeric(6, 3) NOT NULL,
  ban_rate numeric(6, 3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date, champion_id, lane, rank_bracket)
);

COMMENT ON TABLE champion_tier_placements IS
  'Deterministic S/A/B/C bands per lane from the latest snapshot. Rebuilt after each stats sync.';

CREATE INDEX IF NOT EXISTS idx_champion_tier_placements_lookup
  ON champion_tier_placements (rank_bracket, snapshot_date DESC, lane, letter);

CREATE TABLE IF NOT EXISTS patch_analyses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patch_id bigint NOT NULL REFERENCES patches (id) ON DELETE CASCADE,
  model text NOT NULL,
  prompt_hash text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patch_id)
);

COMMENT ON TABLE patch_analyses IS
  'LLM commentary for a patch (lede, watch, movers). One row per patch; never writes tier letters.';
