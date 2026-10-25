-- Additive schema for alert principals/devices and durable notification delivery.
-- Canonical wager records live in 002-registered-tickets.sql (both markets).
-- Provision principals only through the trusted enrollment/authentication path.
-- Store credential hashes; raw bearer tokens are returned once at issuance.
CREATE TABLE IF NOT EXISTS alert_principals (
  principal_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS alert_devices (
  device_id TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL REFERENCES alert_principals(principal_id),
  credential_hash CHAR(64) NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('ios','web')),
  push_endpoint JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS alert_devices_principal_active_idx
  ON alert_devices (principal_id) WHERE revoked_at IS NULL;

-- Delivery outbox is intentionally separate from ticket registration.
-- Enqueue retries are idempotent; workers must claim rows transactionally
-- (e.g. FOR UPDATE SKIP LOCKED) before attempting delivery.
CREATE TABLE IF NOT EXISTS alert_outbox (
  outbox_id BIGSERIAL PRIMARY KEY,
  principal_id TEXT NOT NULL REFERENCES alert_principals(principal_id),
  ticket_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  alert_identity TEXT NOT NULL,
  alert_kind TEXT NOT NULL CHECK (alert_kind IN ('middle','quarter-hedge')),
  milestone TEXT NOT NULL,
  payload JSONB NOT NULL,
  delivery_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_state IN ('pending','sending','sent','retry','dead','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  last_error_code TEXT,
  UNIQUE (principal_id, alert_identity)
);

CREATE INDEX IF NOT EXISTS alert_outbox_pending_idx
  ON alert_outbox (available_at, outbox_id)
  WHERE delivery_state IN ('pending','retry');
