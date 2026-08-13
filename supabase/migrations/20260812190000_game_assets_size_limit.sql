-- Splash arts at q=100 can exceed the original 5 MiB game-assets cap (e.g. Rengar).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    RAISE NOTICE 'storage schema missing; skipping game-assets size bump';
    RETURN;
  END IF;

  UPDATE storage.buckets
  SET file_size_limit = 15728640 -- 15 MiB
  WHERE id = 'game-assets';
END $$;
