-- App profiles for auth users. First login gets a random champion face-crop
-- as the avatar; users can pick a different champion later.

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  avatar_champion_slug text REFERENCES public.champions (slug) ON DELETE SET NULL,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS
  'One row per auth user. avatar_champion_slug is a random roster pick until the user chooses.';
COMMENT ON COLUMN public.profiles.avatar_champion_slug IS
  'Champion whose thumbnail is used as the profile picture.';
COMMENT ON COLUMN public.profiles.avatar_url IS
  'Resolved thumbnail (or splash) URL at assignment time, for display without joining champions.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.pick_random_champion_avatar()
RETURNS TABLE (slug text, avatar_url text)
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT c.slug, COALESCE(c.thumbnail_url, c.image_url)
  FROM public.champions c
  WHERE COALESCE(c.thumbnail_url, c.image_url) IS NOT NULL
  ORDER BY random()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.pick_random_champion_avatar() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ensure_default_avatar()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  champ_slug text;
  champ_url text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.avatar_champion_slug, p.avatar_url
  INTO champ_slug, champ_url
  FROM public.profiles p
  WHERE p.id = uid;

  IF champ_url IS NULL THEN
    SELECT r.slug, r.avatar_url INTO champ_slug, champ_url
    FROM public.pick_random_champion_avatar() r;

    INSERT INTO public.profiles (id, avatar_champion_slug, avatar_url)
    VALUES (uid, champ_slug, champ_url)
    ON CONFLICT (id) DO UPDATE
      SET avatar_champion_slug = COALESCE(public.profiles.avatar_champion_slug, EXCLUDED.avatar_champion_slug),
          avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
          updated_at = now()
    RETURNING avatar_champion_slug, avatar_url
    INTO champ_slug, champ_url;
  END IF;

  IF champ_url IS NOT NULL THEN
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'avatar_champion_slug', champ_slug,
      'avatar_champion_url', champ_url
    )
    WHERE id = uid
      AND COALESCE(raw_user_meta_data->>'avatar_champion_url', '') = '';
  END IF;

  RETURN jsonb_build_object('slug', champ_slug, 'url', champ_url);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_default_avatar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_default_avatar() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user_avatar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  champ_slug text;
  champ_url text;
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'avatar_champion_url', '') <> '' THEN
    RETURN NEW;
  END IF;

  SELECT r.slug, r.avatar_url INTO champ_slug, champ_url
  FROM public.pick_random_champion_avatar() r;

  IF champ_url IS NOT NULL THEN
    NEW.raw_user_meta_data := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'avatar_champion_slug', champ_slug,
      'avatar_champion_url', champ_url
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, avatar_champion_slug, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'avatar_champion_slug',
    NEW.raw_user_meta_data->>'avatar_champion_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user_avatar() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;

-- Skip auth triggers on the embedded local Postgres (no auth schema).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    RAISE NOTICE 'auth.users missing; skipping avatar triggers and backfill';
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS on_auth_user_before_insert_avatar ON auth.users;
  CREATE TRIGGER on_auth_user_before_insert_avatar
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_avatar();

  DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
  CREATE TRIGGER on_auth_user_created_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_profile();

  INSERT INTO public.profiles (id, avatar_champion_slug, avatar_url)
  SELECT u.id, picked.slug, picked.avatar_url
  FROM auth.users u
  CROSS JOIN LATERAL public.pick_random_champion_avatar() picked
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
    AND picked.avatar_url IS NOT NULL;

  UPDATE auth.users u
  SET raw_user_meta_data = COALESCE(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'avatar_champion_slug', p.avatar_champion_slug,
    'avatar_champion_url', p.avatar_url
  )
  FROM public.profiles p
  WHERE u.id = p.id
    AND p.avatar_url IS NOT NULL
    AND COALESCE(u.raw_user_meta_data->>'avatar_champion_url', '') = '';
END $$;
