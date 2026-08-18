-- Shareable spectator links, session listing fields, and optional lobby media.
--
-- The original draft_capture migration kept frames off the server. Users now
-- ask to keep a screenshot (or a short recording) with the session for 30 days.
-- Frames still never leave the device unless the signed-in owner ends a draft.

ALTER TABLE public.draft_sessions
  ADD COLUMN IF NOT EXISTS share_token text,
  ADD COLUMN IF NOT EXISTS you_slug text REFERENCES public.champions (slug) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vs_slug text REFERENCES public.champions (slug) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  ADD COLUMN IF NOT EXISTS media_path text,
  ADD COLUMN IF NOT EXISTS media_kind text CHECK (media_kind IN ('screenshot', 'video')),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_draft_sessions_share_token
  ON public.draft_sessions (share_token)
  WHERE share_token IS NOT NULL;

COMMENT ON COLUMN public.draft_sessions.share_token IS
  'Unguessable spectator token. Presence makes the board readable via get_draft_session_by_share_token.';
COMMENT ON COLUMN public.draft_sessions.media_path IS
  'Object path in the draft-captures bucket, e.g. {user_id}/{session_id}/shot.jpg.';
COMMENT ON COLUMN public.draft_sessions.expires_at IS
  'Media and the session row are eligible for deletion after this time (30 days).';

CREATE OR REPLACE FUNCTION public.get_draft_session_by_share_token(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', id,
    'state', state,
    'you_slug', you_slug,
    'vs_slug', vs_slug,
    'outcome', outcome,
    'ended_at', ended_at,
    'duration_seconds', duration_seconds,
    'updated_at', updated_at
  )
  FROM public.draft_sessions
  WHERE share_token = p_token
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_draft_session_by_share_token(text) IS
  'Read-only spectator lookup. Does not list other sessions.';

GRANT EXECUTE ON FUNCTION public.get_draft_session_by_share_token(text) TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    RAISE NOTICE 'storage schema missing; skipping draft-captures bucket setup';
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'draft-captures',
    'draft-captures',
    false,
    52428800,
    ARRAY['image/jpeg', 'image/webp', 'image/png', 'video/webm']
  )
  ON CONFLICT (id) DO UPDATE
    SET file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can manage own draft captures'
  ) THEN
    CREATE POLICY "Users can manage own draft captures"
      ON storage.objects
      FOR ALL
      TO authenticated
      USING (
        bucket_id = 'draft-captures'
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'draft-captures'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END
$$;
