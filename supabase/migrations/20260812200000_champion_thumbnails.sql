-- Face-crop thumbnails from WildRiftFire tiles, separate from splash art.

ALTER TABLE champions
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_source_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_content_hash text,
  ADD COLUMN IF NOT EXISTS thumbnail_storage_path text;

COMMENT ON COLUMN champions.thumbnail_url IS
  'Square face-crop served to clients (Supabase Storage after thumbnail sync).';
COMMENT ON COLUMN champions.thumbnail_source_url IS
  'Upstream WildRiftFire/Mobafire square portrait used as the download source.';
COMMENT ON COLUMN champions.thumbnail_content_hash IS
  'SHA-256 hex of the hosted thumbnail bytes; used to skip unchanged uploads.';
COMMENT ON COLUMN champions.thumbnail_storage_path IS
  'Object path within the game-assets bucket, e.g. champions/aatrox-thumb.png.';
