-- Claim column so a viewed pairing is generated once. started_at is the lock;
-- stale claims (worker died) can be taken again after 10 minutes.

ALTER TABLE matchup_guide_requests
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

COMMENT ON COLUMN matchup_guide_requests.started_at IS
  'When a worker claimed this pairing. Null means queued; set until generated_at is written.';

CREATE INDEX IF NOT EXISTS idx_matchup_guide_requests_inflight
  ON matchup_guide_requests (started_at)
  WHERE generated_at IS NULL AND started_at IS NOT NULL;
