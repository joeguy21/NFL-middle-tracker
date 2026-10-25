-- Proposed additive schema. NOT applied. Validate on disposable PostgreSQL first.
-- General registration is distinct from spread-only alert enrollment.
CREATE TABLE IF NOT EXISTS registered_tickets (
  principal_id TEXT NOT NULL REFERENCES alert_principals(principal_id),
  ticket_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  market_type TEXT NOT NULL CHECK (market_type IN ('moneyline','spread')),
  team_code TEXT NOT NULL,
  opponent_code TEXT NOT NULL,
  handicap NUMERIC(7,2),
  accepted_american_odds INTEGER NOT NULL CHECK (accepted_american_odds <> 0),
  stake NUMERIC(12,2) NOT NULL CHECK (stake > 0),
  book TEXT NOT NULL DEFAULT '',
  ticket_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (principal_id, ticket_id),
  CHECK (team_code <> opponent_code),
  CHECK ((market_type = 'moneyline' AND handicap IS NULL) OR
         (market_type = 'spread' AND handicap IS NOT NULL AND ABS(handicap) <= 100))
);
CREATE INDEX IF NOT EXISTS registered_tickets_event_idx ON registered_tickets(event_id);
