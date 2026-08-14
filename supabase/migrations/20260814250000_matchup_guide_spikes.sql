-- Level windows for "When can I fight".
-- Five beats from the matchup rail: LVL 1, LVL 3, LVL 5, 1st ITEM, LVL 11.
-- label is the play at that beat, not a lane verdict.

ALTER TABLE matchup_guides
  ADD COLUMN IF NOT EXISTS spikes jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN matchup_guides.spikes IS
  'Fight windows: at, who (you/them/even), label. Written from the you seat.';
