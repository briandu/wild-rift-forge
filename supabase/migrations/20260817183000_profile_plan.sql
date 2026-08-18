-- Paid tier on the profile. Free is the default; Pro and Squad unlock draft.
-- Clients cannot raise their own plan (trigger keeps authenticated writes on the old value).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'Free';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_plan_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_plan_check
      CHECK (plan IN ('Free', 'Pro', 'Squad'));
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.plan IS
  'Forge plan. Free is default. Pro and Squad unlock the draft assistant. Set by billing or an admin grant, not the client.';

CREATE OR REPLACE FUNCTION public.protect_profile_plan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.plan := 'Free';
    ELSIF NEW.plan IS DISTINCT FROM OLD.plan THEN
      NEW.plan := OLD.plan;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_plan ON public.profiles;
CREATE TRIGGER protect_profile_plan
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_plan();

-- Founder grant: Squad is the top plan (Pro plus five seats).
UPDATE public.profiles p
SET plan = 'Squad', updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) = 'brian.bh.du@gmail.com';
