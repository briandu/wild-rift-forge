-- Let a signed-in user pick a champion face as their avatar.
-- Writes profiles and (when auth.users exists) user_metadata so the header can read it.

CREATE OR REPLACE FUNCTION public.set_champion_avatar(champ_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  champ_url text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(c.thumbnail_url, c.image_url) INTO champ_url
  FROM public.champions c
  WHERE c.slug = champ_slug;

  IF champ_url IS NULL THEN
    RAISE EXCEPTION 'Champion not found or has no art';
  END IF;

  INSERT INTO public.profiles (id, avatar_champion_slug, avatar_url)
  VALUES (uid, champ_slug, champ_url)
  ON CONFLICT (id) DO UPDATE
    SET avatar_champion_slug = EXCLUDED.avatar_champion_slug,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = now();

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'avatar_champion_slug', champ_slug,
      'avatar_champion_url', champ_url
    )
    WHERE id = uid;
  END IF;

  RETURN jsonb_build_object('slug', champ_slug, 'url', champ_url);
END;
$$;

REVOKE ALL ON FUNCTION public.set_champion_avatar(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_champion_avatar(text) TO authenticated;
