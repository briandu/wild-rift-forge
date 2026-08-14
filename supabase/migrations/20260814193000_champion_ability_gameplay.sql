-- Gameplay numbers from versioned champion snapshots (data/normalized/...).
-- Riot scrape still owns name / description / icons. These columns are filled
-- by the snapshot import and must survive replaceChampionAbilities upserts.

ALTER TABLE champion_abilities
  ADD COLUMN IF NOT EXISTS cooldown jsonb,
  ADD COLUMN IF NOT EXISTS cost jsonb,
  ADD COLUMN IF NOT EXISTS numeric_summary text,
  ADD COLUMN IF NOT EXISTS snapshot_patch text,
  ADD COLUMN IF NOT EXISTS gameplay_source text;

COMMENT ON COLUMN champion_abilities.cooldown IS
  'Ranked cooldown seconds from the gameplay snapshot. Null for most passives.';
COMMENT ON COLUMN champion_abilities.cost IS
  'Ranked resource cost { type, values } from the gameplay snapshot.';
COMMENT ON COLUMN champion_abilities.numeric_summary IS
  'Compact sourced numeric prose. Not a fully structured effect tree.';
COMMENT ON COLUMN champion_abilities.snapshot_patch IS
  'Patch id of the snapshot that last wrote gameplay columns, e.g. 7.2c.';
COMMENT ON COLUMN champion_abilities.gameplay_source IS
  'Provenance for gameplay columns (wildriftfire_baseline, riot_patch_notes, manual_ingame).';
