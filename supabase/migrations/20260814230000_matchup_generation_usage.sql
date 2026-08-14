-- Spend ledger for authored matchup OpenAI calls. Hour and day buckets are
-- incremented atomically before a request is sent so a traffic spike cannot
-- burn an unbounded number of gpt-5.6-sol tokens.

CREATE TABLE IF NOT EXISTS matchup_generation_usage (
  period text NOT NULL CHECK (period IN ('hour', 'day')),
  bucket_start timestamptz NOT NULL,
  calls integer NOT NULL DEFAULT 0 CHECK (calls >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (period, bucket_start)
);

COMMENT ON TABLE matchup_generation_usage IS
  'UTC hour/day counts of matchup OpenAI calls. Reserve-before-send; never decrement on failure.';