-- Coexist legacy (cn_stats_v1) and blended_v1 tier placements so the new
-- score can be previewed before the API flips. Snapshots gain an optional
-- patch_version so CN/global patch divergence is detectable later.

ALTER TABLE champion_tier_placements
  ADD COLUMN IF NOT EXISTS ruleset text NOT NULL DEFAULT 'cn_stats_v1';

ALTER TABLE champion_tier_placements
  ADD COLUMN IF NOT EXISTS adjusted_win_rate numeric(6, 3);

ALTER TABLE champion_tier_placements
  ADD COLUMN IF NOT EXISTS skill_spread numeric(6, 3);

ALTER TABLE champion_tier_placements
  ADD COLUMN IF NOT EXISTS confidence numeric(6, 3);

ALTER TABLE champion_tier_placements
  ADD COLUMN IF NOT EXISTS previous_letter text;

ALTER TABLE champion_stat_snapshots
  ADD COLUMN IF NOT EXISTS patch_version text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'champion_tier_placements_ruleset_check'
  ) THEN
    ALTER TABLE champion_tier_placements
      ADD CONSTRAINT champion_tier_placements_ruleset_check
      CHECK (ruleset IN ('cn_stats_v1', 'blended_v1'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'champion_tier_placements_previous_letter_check'
  ) THEN
    ALTER TABLE champion_tier_placements
      ADD CONSTRAINT champion_tier_placements_previous_letter_check
      CHECK (previous_letter IS NULL OR previous_letter IN ('S', 'A', 'B', 'C'));
  END IF;
END $$;

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.champion_tier_placements'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) NOT LIKE '%ruleset%'
  LOOP
    EXECUTE format('ALTER TABLE champion_tier_placements DROP CONSTRAINT %I', rec.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'champion_tier_placements_snapshot_lane_bracket_ruleset_key'
  ) THEN
    ALTER TABLE champion_tier_placements
      ADD CONSTRAINT champion_tier_placements_snapshot_lane_bracket_ruleset_key
      UNIQUE (snapshot_date, champion_id, lane, rank_bracket, ruleset);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_champion_tier_placements_ruleset_lookup
  ON champion_tier_placements (ruleset, rank_bracket, snapshot_date DESC, lane, letter);

COMMENT ON COLUMN champion_tier_placements.ruleset IS
  'Scoring ruleset that produced this row. cn_stats_v1 is the live API default until blended_v1 is accepted.';

COMMENT ON COLUMN champion_stat_snapshots.patch_version IS
  'Global patch version known at ingest time. Null on rows written before this column existed.';
