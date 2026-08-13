-- Champion ability kits scraped from official Wild Rift champion pages.
-- One row per (champion, slot); replaced on each detail sync.

CREATE TABLE IF NOT EXISTS champion_abilities (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  champion_id bigint NOT NULL REFERENCES champions (id) ON DELETE CASCADE,
  slot text NOT NULL CHECK (slot IN ('passive', '1', '2', '3', 'ultimate')),
  name text NOT NULL,
  description text,
  icon_url text,
  video_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (champion_id, slot)
);

COMMENT ON TABLE champion_abilities IS
  'Current ability kit per champion from wildrift.leagueoflegends.com detail pages.';

CREATE INDEX IF NOT EXISTS idx_champion_abilities_champion_id
  ON champion_abilities (champion_id);
