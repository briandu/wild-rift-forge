-- Persist champion-pool priority so Custom / Save order can stick across devices.

ALTER TABLE public.user_champion_pool
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.user_champion_pool.sort_order IS
  'Lower numbers are higher priority. #1 in a lane is the champion Forge assumes you will play.';

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY user_id ORDER BY created_at ASC, id ASC) - 1 AS n
  FROM public.user_champion_pool
)
UPDATE public.user_champion_pool AS pool
SET sort_order = ranked.n
FROM ranked
WHERE pool.id = ranked.id;

CREATE INDEX IF NOT EXISTS idx_user_champion_pool_user_sort
  ON public.user_champion_pool (user_id, sort_order, created_at);

DROP POLICY IF EXISTS "Users can update own pool" ON public.user_champion_pool;
CREATE POLICY "Users can update own pool"
  ON public.user_champion_pool FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT UPDATE ON TABLE public.user_champion_pool TO authenticated;
