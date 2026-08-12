-- Champion image hosting: track Riot source URL + content hash, host binaries
-- in Supabase Storage (bucket game-assets). Upload only when the hash changes.

ALTER TABLE champions
  ADD COLUMN IF NOT EXISTS image_source_url text,
  ADD COLUMN IF NOT EXISTS image_content_hash text,
  ADD COLUMN IF NOT EXISTS image_storage_path text;

COMMENT ON COLUMN champions.image_url IS 'Public URL served to clients (Supabase Storage after asset sync; Riot CDN as temporary fallback).';
COMMENT ON COLUMN champions.image_source_url IS 'Upstream Riot CDN URL used as the download source for asset sync.';
COMMENT ON COLUMN champions.image_content_hash IS 'SHA-256 hex of the hosted image bytes; used to skip unchanged uploads.';
COMMENT ON COLUMN champions.image_storage_path IS 'Object path within the game-assets Storage bucket, e.g. champions/aatrox.webp.';

-- Existing rows stored the Riot URL in image_url; copy into image_source_url.
UPDATE champions
SET image_source_url = image_url
WHERE image_source_url IS NULL
  AND image_url IS NOT NULL;

-- Storage schema exists on Supabase (and supabase start), but not on the
-- embedded local Postgres used by scripts/dev-db.mjs — skip there.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    RAISE NOTICE 'storage schema missing; skipping game-assets bucket setup';
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'game-assets',
    'game-assets',
    true,
    5242880, -- 5 MiB; champion icons stay well under this
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/avif']
  )
  ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read game-assets'
  ) THEN
    CREATE POLICY "Public read game-assets"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'game-assets');
  END IF;
END $$;
