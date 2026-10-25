const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = (name) => fs.readFileSync(
  path.join(__dirname, "..", "db", "migrations", name),
  "utf8"
);

test("alert schema keeps one canonical registered ticket table", () => {
  const core = migration("001-tracked-alerts.sql");
  const tickets = migration("002-registered-tickets.sql");

  assert.match(core, /CREATE TABLE IF NOT EXISTS alert_principals/);
  assert.match(core, /CREATE TABLE IF NOT EXISTS alert_devices/);
  assert.match(core, /CREATE TABLE IF NOT EXISTS alert_outbox/);
  assert.doesNotMatch(core, /CREATE TABLE IF NOT EXISTS tracked_tickets\s*\(/);

  assert.match(tickets, /CREATE TABLE IF NOT EXISTS registered_tickets/);
  assert.match(tickets, /market_type IN \('moneyline','spread'\)/);
  assert.match(tickets, /tracking_enabled BOOLEAN NOT NULL DEFAULT TRUE/);
  assert.match(tickets, /market_type = 'moneyline' AND handicap IS NULL/);
  assert.match(tickets, /market_type = 'spread' AND handicap IS NOT NULL/);
});

test("alert schema preserves ticket ownership and idempotent delivery constraints", () => {
  const core = migration("001-tracked-alerts.sql");
  const tickets = migration("002-registered-tickets.sql");

  assert.match(core, /principal_id TEXT NOT NULL REFERENCES alert_principals\(principal_id\)/);
  assert.match(core, /credential_hash CHAR\(64\) NOT NULL UNIQUE/);
  assert.match(core, /UNIQUE \(principal_id, alert_identity\)/);
  assert.match(core, /delivery_state IN \('pending','sending','sent','retry','dead','cancelled'\)/);
  assert.match(tickets, /PRIMARY KEY \(principal_id, ticket_id\)/);
  assert.match(tickets, /stake NUMERIC\(12,2\) NOT NULL CHECK \(stake > 0\)/);
});

test("alert migrations are additive and do not target legacy tracker data", () => {
  const all = migration("001-tracked-alerts.sql") + "\n" + migration("002-registered-tickets.sql");
  assert.doesNotMatch(all, /\b(DROP|TRUNCATE)\s+(TABLE|SCHEMA)\b/i);
  assert.doesNotMatch(all, /\bDELETE\s+FROM\s+tracker_records\b/i);
  assert.doesNotMatch(all, /\bALTER\s+TABLE\s+tracker_records\b/i);
});
