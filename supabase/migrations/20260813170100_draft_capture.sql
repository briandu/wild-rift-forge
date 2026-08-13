-- Draft capture: saved screen layouts, draft sessions, and recognition corrections.
--
-- Privacy stance: no captured frame is ever stored. Only the derived 64-bit hash of
-- an individual champion tile is kept, and only when the user corrects a misread, so
-- the reference library can learn from real frames.

-- Per-device champion-select geometry, keyed by aspect ratio.
-- Region rects are normalized fractions of the frame so they survive a resolution
-- change on the same device.
CREATE TABLE IF NOT EXISTS public.draft_capture_profiles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  -- e.g. '16:9', '20:9'. One saved layout per shape of shared window.
  aspect_key text NOT NULL,
  frame_width integer NOT NULL CHECK (frame_width > 0),
  frame_height integer NOT NULL CHECK (frame_height > 0),
  -- Array of { key, role, index, rect: { x, y, width, height } }.
  regions jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, aspect_key)
);

COMMENT ON TABLE public.draft_capture_profiles IS
  'Calibrated champion-select region rects per user and aspect ratio, as normalized fractions.';

-- A draft the user read or built. Kept so a read survives a refresh, feeds history,
-- and can later be scored against the match outcome.
CREATE TABLE IF NOT EXISTS public.draft_sessions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  -- 'manual' when typed in, 'capture' when read off the screen.
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'capture')),
  patch_id bigint REFERENCES public.patches (id) ON DELETE SET NULL,
  -- { allies, enemies, allyBans, enemyBans, mySlotIndex }.
  state jsonb NOT NULL,
  -- Per-slot recognition confidence, so accuracy can be measured over time.
  confidence jsonb,
  outcome text CHECK (outcome IN ('win', 'loss')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.draft_sessions IS
  'Draft boards a user read or built. Outcome is optional and user-reported.';

CREATE INDEX IF NOT EXISTS idx_draft_sessions_user
  ON public.draft_sessions (user_id, created_at DESC);

-- Every correction is a labelled training example for the reference library.
CREATE TABLE IF NOT EXISTS public.draft_recognition_corrections (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  session_id bigint REFERENCES public.draft_sessions (id) ON DELETE SET NULL,
  -- Slot the correction applies to, e.g. 'ally-2' or 'ban-enemy-0'.
  slot_key text NOT NULL,
  predicted_slug text REFERENCES public.champions (slug) ON DELETE SET NULL,
  corrected_slug text NOT NULL REFERENCES public.champions (slug) ON DELETE CASCADE,
  predicted_confidence numeric(5, 4),
  -- Hash of the tile as it actually rendered. This, not the frame, is what makes the
  -- reference library improve with use.
  tile_hash text NOT NULL CHECK (tile_hash ~ '^[0-9a-f]{16}$'),
  tile_color text CHECK (tile_color ~ '^[0-9a-f]{96}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.draft_recognition_corrections IS
  'User fixes to a misread slot. Stores only the derived tile hash, never the frame.';

CREATE INDEX IF NOT EXISTS idx_draft_corrections_champion
  ON public.draft_recognition_corrections (corrected_slug, created_at DESC);

ALTER TABLE public.draft_capture_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_recognition_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own capture profiles" ON public.draft_capture_profiles;
CREATE POLICY "Users can read own capture profiles"
  ON public.draft_capture_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own capture profiles" ON public.draft_capture_profiles;
CREATE POLICY "Users can insert own capture profiles"
  ON public.draft_capture_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own capture profiles" ON public.draft_capture_profiles;
CREATE POLICY "Users can update own capture profiles"
  ON public.draft_capture_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own capture profiles" ON public.draft_capture_profiles;
CREATE POLICY "Users can delete own capture profiles"
  ON public.draft_capture_profiles FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own draft sessions" ON public.draft_sessions;
CREATE POLICY "Users can read own draft sessions"
  ON public.draft_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own draft sessions" ON public.draft_sessions;
CREATE POLICY "Users can insert own draft sessions"
  ON public.draft_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own draft sessions" ON public.draft_sessions;
CREATE POLICY "Users can update own draft sessions"
  ON public.draft_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own draft sessions" ON public.draft_sessions;
CREATE POLICY "Users can delete own draft sessions"
  ON public.draft_sessions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own corrections" ON public.draft_recognition_corrections;
CREATE POLICY "Users can read own corrections"
  ON public.draft_recognition_corrections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own corrections" ON public.draft_recognition_corrections;
CREATE POLICY "Users can insert own corrections"
  ON public.draft_recognition_corrections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.draft_capture_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.draft_sessions TO authenticated;
GRANT SELECT, INSERT ON TABLE public.draft_recognition_corrections TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.draft_capture_profiles_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.draft_sessions_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.draft_recognition_corrections_id_seq TO authenticated;
