"use strict";

// Deliberately requires an explicit, exact database-name confirmation.
// Usage: ALERT_MIGRATION_CONFIRM_DB=nfl-middle-tracker-test-db npm run db:migrate
// Never configure this as the web service start command or an automatic deploy hook.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const EXPECTED_DB = "nfl-middle-tracker-test-db";
const confirm = process.env.ALERT_MIGRATION_CONFIRM_DB;
const connectionString = process.env.DATABASE_URL;
const migrationFiles = [
  "001-tracked-alerts.sql",
  "002-registered-tickets.sql",
];

async function main() {
  if (confirm !== EXPECTED_DB) throw new Error("Refusing migration: set ALERT_MIGRATION_CONFIRM_DB to the exact test database name.");
  if (!connectionString) throw new Error("Refusing migration: DATABASE_URL is missing.");

  const pool = new Pool({
    connectionString,
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 10000,
  });
  const client = await pool.connect();
  try {
    const identity = await client.query("SELECT current_database() AS db, current_user AS db_user");
    if (identity.rows[0]?.db !== EXPECTED_DB) {
      throw new Error("Refusing migration: connected database name did not match the approved test database.");
    }
    console.log("Verified approved test database:", identity.rows[0].db);

    await client.query("SELECT pg_advisory_lock(hashtext($1))", ["nfl-middle-tracker-alert-schema-migrations"]);
    try {
      await client.query(`CREATE TABLE IF NOT EXISTS alert_schema_migrations (
        migration_id TEXT PRIMARY KEY,
        sha256 CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);

      for (const filename of migrationFiles) {
        const sql = fs.readFileSync(path.join(__dirname, "..", "db", "migrations", filename), "utf8");
        const checksum = crypto.createHash("sha256").update(sql).digest("hex");
        const existing = await client.query(
          "SELECT sha256 FROM alert_schema_migrations WHERE migration_id = $1",
          [filename]
        );
        if (existing.rows.length) {
          if (existing.rows[0].sha256.trim() !== checksum) {
            throw new Error("Migration checksum mismatch for " + filename + "; manual review required.");
          }
          console.log("Already applied:", filename);
          continue;
        }

        await client.query("BEGIN");
        try {
          await client.query(sql);
          await client.query(
            "INSERT INTO alert_schema_migrations(migration_id, sha256) VALUES($1, $2)",
            [filename, checksum]
          );
          await client.query("COMMIT");
          console.log("Applied:", filename);
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }

      const verified = await client.query(
        `SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = ANY($1::text[])
          ORDER BY table_name`,
        [["alert_principals", "alert_devices", "alert_outbox", "registered_tickets", "alert_schema_migrations"]]
      );
      const actual = verified.rows.map((row) => row.table_name);
      const required = ["alert_principals", "alert_devices", "alert_outbox", "registered_tickets", "alert_schema_migrations"];
      const missing = required.filter((name) => !actual.includes(name));
      if (missing.length) throw new Error("Schema verification failed; missing: " + missing.join(", "));
      console.log("Schema verified. Required alert tables:", actual.join(", "));
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", ["nfl-middle-tracker-alert-schema-migrations"]);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Alert migration halted:", error.message);
  process.exitCode = 1;
});
