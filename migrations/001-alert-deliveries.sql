-- Apply with the service database role before enabling the alert worker.
CREATE TABLE IF NOT EXISTS tracker_alert_deliveries (
  user_id UUID NOT NULL,
  alert_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('middle','hedge')),
  ticket_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, alert_id)
);
CREATE INDEX IF NOT EXISTS tracker_alert_deliveries_recent_idx
  ON tracker_alert_deliveries(user_id, created_at DESC);
