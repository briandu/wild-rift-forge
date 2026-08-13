-- Per-user champion pool and saved matchup pairs.
-- Login copy already promises these follow the account across devices.

CREATE TABLE IF NOT EXISTS public.user_champion_pool (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  champion_slug text NOT NULL REFERENCES public.champions (slug) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, champion_slug)
);

COMMENT ON TABLE public.user_champion_pool IS
  'Champions the user plays. Used to sort counters, draft suggestions, and digest mail.';

CREATE INDEX IF NOT EXISTS idx_user_champion_pool_user
  ON public.user_champion_pool (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_saved_matchups (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  you_slug text NOT NULL REFERENCES public.champions (slug) ON DELETE CASCADE,
  them_slug text NOT NULL REFERENCES public.champions (slug) ON DELETE CASCADE,
  lane text NOT NULL CHECK (lane IN ('Top', 'Jungle', 'Mid', 'Dragon', 'Support')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, you_slug, them_slug, lane)
);

COMMENT ON TABLE public.user_saved_matchups IS
  'Matchup pairs the user pinned from /matchups.';

CREATE INDEX IF NOT EXISTS idx_user_saved_matchups_user
  ON public.user_saved_matchups (user_id, created_at DESC);

ALTER TABLE public.user_champion_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_saved_matchups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own pool" ON public.user_champion_pool;
CREATE POLICY "Users can read own pool"
  ON public.user_champion_pool FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own pool" ON public.user_champion_pool;
CREATE POLICY "Users can insert own pool"
  ON public.user_champion_pool FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own pool" ON public.user_champion_pool;
CREATE POLICY "Users can delete own pool"
  ON public.user_champion_pool FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own saved matchups" ON public.user_saved_matchups;
CREATE POLICY "Users can read own saved matchups"
  ON public.user_saved_matchups FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own saved matchups" ON public.user_saved_matchups;
CREATE POLICY "Users can insert own saved matchups"
  ON public.user_saved_matchups FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own saved matchups" ON public.user_saved_matchups;
CREATE POLICY "Users can delete own saved matchups"
  ON public.user_saved_matchups FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON TABLE public.user_champion_pool TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.user_saved_matchups TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.user_champion_pool_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.user_saved_matchups_id_seq TO authenticated;
