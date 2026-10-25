-- Proposed additive schema for tracked-ticket registration and durable delivery.
-- Principal/device registry: provision principals through a trusted admin path.
-- Store only credential hashes; raw bearer tokens are returned once at issuance.
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

-- NOT applied to any database. Requires authenticated principal IDs from a
-- separately designed auth/session layer before endpoint integration.

CREATE TABLE IF NOT EXISTS tracked_tickets (
  principal_id TEXT NOT NULL,
  ticket_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  team_code TEXT NOT NULL,
  opponent_code TEXT NOT NULL,
  handicap NUMERIC(7,2) NOT NULL,
  accepted_american_odds INTEGER NOT NULL,
  stake NUMERIC(12,2) NOT NULL CHECK (stake > 0),
  book TEXT NOT NULL DEFAULT '',
  tracking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ticket_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (principal_id, ticket_id),
  CHECK (team_code <> opponent_code),
  CHECK (accepted_american_odds <> 0),
  CHECK (ABS(handicap) <= 100)
);

CREATE INDEX IF NOT EXISTS tracked_tickets_event_enabled_idx
  ON tracked_tickets (event_id) WHERE tracking_enabled = TRUE;

-- Unique event identity makes enqueue retries idempotent. Delivery workers
-- must claim rows transactionally (e.g. FOR UPDATE SKIP LOCKED).
CREATE TABLE IF NOT EXISTS alert_outbox (
  outbox_id BIGSERIAL PRIMARY KEY,
  principal_id TEXT NOT NULL,
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
