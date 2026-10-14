-- Champion art in game-assets was public, so browsers and crawlers downloaded
-- the originals and exhausted project egress. Keep the objects; stop serving them.
-- Turn public back on only after portraits are hosted somewhere else.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    RAISE NOTICE 'storage schema missing; skipping game-assets lockdown';
    RETURN;
  END IF;

  UPDATE storage.buckets
  SET public = false
  WHERE id = 'game-assets';

  DROP POLICY IF EXISTS "Public read game-assets" ON storage.objects;
END $$;
