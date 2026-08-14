-- Append-only record of pool/tier emails so the same patch or snapshot
-- is not sent twice. Service role writes; users do not read this table yet.

CREATE TABLE IF NOT EXISTS public.alert_deliveries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('pool', 'tier')),
  dedupe_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, dedupe_key)
);

COMMENT ON TABLE public.alert_deliveries IS
  'History of pool/tier alert emails. kind+dedupe_key is pool:{version} or tier:{snapshot_date}.';

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_user
  ON public.alert_deliveries (user_id, kind, created_at DESC);

ALTER TABLE public.alert_deliveries ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN public.profiles.notify_pool IS
  'Email when a new patch names a champion in the user pool. Sender: scripts/send-account-alerts.mjs.';
COMMENT ON COLUMN public.profiles.notify_tier IS
  'Email when a pool champion moves a full S/A/B/C letter. Sender: scripts/send-account-alerts.mjs.';
COMMENT ON COLUMN public.profiles.notify_counters IS
  'Reserved. Pairwise counter history is not ingested, so this toggle does not send mail.';
