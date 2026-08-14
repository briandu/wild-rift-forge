-- Best-to-worst lane order on the account. When a champion plays more than
-- one lane, the first matching role wins ties for which matchup to load.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_roles text[] NOT NULL
    DEFAULT ARRAY['Top', 'Jungle', 'Mid', 'Dragon', 'Support']::text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_preferred_roles_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_preferred_roles_check
      CHECK (
        cardinality(preferred_roles) = 5
        AND preferred_roles <@ ARRAY['Top', 'Jungle', 'Mid', 'Dragon', 'Support']::text[]
        AND ARRAY['Top', 'Jungle', 'Mid', 'Dragon', 'Support']::text[] <@ preferred_roles
      );
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.preferred_roles IS
  'Best-to-worst lane order. When a champion plays more than one lane, the first matching role wins ties for which matchup to load.';
