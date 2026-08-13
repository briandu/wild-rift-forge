-- Perceptual signatures used to recognise champion portraits in a captured
-- champion-select frame.
--
-- Recognition runs entirely in the browser: the client downloads this table as a
-- small manifest and compares a 64-bit difference hash per tile. Nothing about a
-- user's screen is uploaded, and no model inference is involved.

CREATE TABLE IF NOT EXISTS public.champion_icon_signatures (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  champion_id bigint NOT NULL REFERENCES public.champions (id) ON DELETE CASCADE,
  -- 'thumb' and 'portrait' are derived from hosted art. 'captured' signatures come
  -- from frames a user confirmed, so they match the real game renderer best and are
  -- preferred when several variants tie.
  variant text NOT NULL CHECK (variant IN ('thumb', 'portrait', 'captured')),
  hash_algo text NOT NULL,
  -- 16 lowercase hex characters: a 64-bit difference hash.
  hash_bits text NOT NULL CHECK (hash_bits ~ '^[0-9a-f]{16}$'),
  -- 96 lowercase hex characters: a 4x4 grid of average RGB, used to break ties
  -- between champions with similar luma structure.
  color_bits text CHECK (color_bits ~ '^[0-9a-f]{96}$'),
  -- Where the bytes came from, so a signature can be regenerated or invalidated.
  source_url text,
  -- SHA-256 of the source image, so unchanged art is not rehashed.
  source_content_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (champion_id, variant, hash_algo)
);

COMMENT ON TABLE public.champion_icon_signatures IS
  'Perceptual hashes of champion portraits, served to the browser for champion-select recognition.';
COMMENT ON COLUMN public.champion_icon_signatures.variant IS
  'thumb/portrait come from hosted art; captured comes from user-confirmed frames and wins ties.';
COMMENT ON COLUMN public.champion_icon_signatures.hash_bits IS
  '64-bit difference hash as 16 hex chars, computed after insetting to the circle the game draws.';

CREATE INDEX IF NOT EXISTS idx_champion_icon_signatures_lookup
  ON public.champion_icon_signatures (hash_algo, variant);

-- The manifest is public data, exactly like the champion art it is derived from.
ALTER TABLE public.champion_icon_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read champion icon signatures" ON public.champion_icon_signatures;
CREATE POLICY "Public read champion icon signatures"
  ON public.champion_icon_signatures FOR SELECT TO anon, authenticated
  USING (true);

GRANT SELECT ON TABLE public.champion_icon_signatures TO anon, authenticated;
