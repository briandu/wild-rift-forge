-- Trigger helpers must not be callable via PostgREST. ensure_default_avatar
-- is only for signed-in users.

REVOKE ALL ON FUNCTION public.pick_random_champion_avatar() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_avatar() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_default_avatar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_default_avatar() TO authenticated;
