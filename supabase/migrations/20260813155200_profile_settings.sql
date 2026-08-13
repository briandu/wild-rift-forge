-- Account settings stored on profiles: Riot ID string, region, notification
-- prefs, and a Pro waitlist timestamp. Match history / overlay stay later.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS riot_id text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS notify_pool boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_tier boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_counters boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_digest boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_channel text NOT NULL DEFAULT 'Email',
  ADD COLUMN IF NOT EXISTS pro_waitlisted_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_region_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_region_check
      CHECK (region IS NULL OR region IN ('NA', 'EUW', 'BR', 'KR', 'SEA'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_notify_channel_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_notify_channel_check
      CHECK (notify_channel IN ('Email', 'Push', 'Both'));
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.riot_id IS
  'Summoner#TAG entered by the user (or filled from Riot RSO later). Not verified until SSO exists.';
COMMENT ON COLUMN public.profiles.region IS 'Client region preference for copy and future match history.';
COMMENT ON COLUMN public.profiles.notify_digest IS 'Weekly digest opt-in; sender reads this flag.';
COMMENT ON COLUMN public.profiles.pro_waitlisted_at IS 'Set when the user joins the Forge Pro waitlist.';

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

GRANT INSERT ON TABLE public.profiles TO authenticated;
