-- Wild Rift Forge initial schema: raw source storage, patches, patch changes, champions.
-- History is append-only: patch_changes rows are never overwritten by later game data.

CREATE TABLE IF NOT EXISTS raw_sources (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_type text NOT NULL,
  url text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  content_hash text NOT NULL UNIQUE,
  content_type text NOT NULL DEFAULT 'text/html',
  raw_body text NOT NULL,
  parser_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE raw_sources IS 'Original downloaded source documents. Kept so parser bugs can be fixed and pages reprocessed without redownloading.';

CREATE INDEX IF NOT EXISTS idx_raw_sources_source_type ON raw_sources (source_type);
CREATE INDEX IF NOT EXISTS idx_raw_sources_url ON raw_sources (url);

CREATE TABLE IF NOT EXISTS patches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  version text NOT NULL UNIQUE,
  title text NOT NULL,
  release_date timestamptz,
  source_url text NOT NULL,
  raw_source_id bigint REFERENCES raw_sources (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE patches IS 'Wild Rift patches, one row per published patch notes article (e.g. 7.2b).';

CREATE TABLE IF NOT EXISTS patch_changes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patch_id bigint NOT NULL REFERENCES patches (id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('champion', 'item', 'rune', 'system')),
  entity_name text NOT NULL,
  change_type text NOT NULL CHECK (change_type IN ('buff', 'nerf', 'adjustment', 'new', 'rework', 'unknown')),
  ability text,
  property text,
  old_value jsonb,
  new_value jsonb,
  description text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE patch_changes IS 'Normalized per-change records extracted from patch notes. Append-only history.';

CREATE INDEX IF NOT EXISTS idx_patch_changes_patch_id ON patch_changes (patch_id);
CREATE INDEX IF NOT EXISTS idx_patch_changes_entity ON patch_changes (entity_type, entity_name);

CREATE TABLE IF NOT EXISTS champions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  title text,
  roles text[] NOT NULL DEFAULT '{}',
  difficulty text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE champions IS 'Wild Rift champion roster, synced from the official champions pages.';

CREATE INDEX IF NOT EXISTS idx_champions_name ON champions (name);
