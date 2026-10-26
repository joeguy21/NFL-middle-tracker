// NFL live-odds research collector
// Run as a separate Render Background Worker: node odds-collector.js
// Required env: FANLINE_API_KEY, DATABASE_URL
// Optional env: ODDS_POLL_MS (default 450000 = 7.5 minutes)
const { Pool } = require("pg");
const API_KEY = process.env.FANLINE_API_KEY;
const DB = process.env.DATABASE_URL;
const BASE = "https://api.fanlinewire.com";
const INTERVAL = Math.max(60000, Number(process.env.ODDS_POLL_MS || 450000));
if (!API_KEY || !DB) throw new Error("Set FANLINE_API_KEY and DATABASE_URL.");
const pool = new Pool({
  connectionString: DB,
  ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
  max: 2
});
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS odds_observations (
      observation_id BIGSERIAL PRIMARY KEY,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      source_updated_at TIMESTAMPTZ,
      source TEXT NOT NULL DEFAULT 'FanLine board',
      league TEXT NOT NULL DEFAULT 'NFL',
      payload JSONB NOT NULL,
      request_status INTEGER,
      error_text TEXT
    );
    CREATE INDEX IF NOT EXISTS odds_observations_captured_idx
      ON odds_observations(captured_at);
  `);
}
async function poll() {
  const capturedAt = new Date().toISOString();
  try {
    const response = await fetch(BASE + "/v1/board.json", {
      headers: { "x-api-key": API_KEY, Accept: "application/json" },
      signal: AbortSignal.timeout(20000)
    });
    const raw = await response.text();
    let payload;
    try { payload = JSON.parse(raw); } catch { payload = { raw_text: raw.slice(0, 1500000) }; }
    if (!response.ok) {
      await pool.query(
        "INSERT INTO odds_observations(captured_at,payload,request_status,error_text) VALUES($1,$2::jsonb,$3,$4)",
        [capturedAt, JSON.stringify(payload), response.status, "FanLine request failed"]
      );
      console.error(new Date().toISOString(), "FanLine status", response.status);
      return;
    }
    const sourceTime = payload && (payload.updated_at || payload.last_updated || payload.timestamp);
    await pool.query(
      "INSERT INTO odds_observations(captured_at,source_updated_at,payload,request_status) VALUES($1,$2,$3::jsonb,$4)",
      [capturedAt, sourceTime ? new Date(sourceTime) : null, JSON.stringify(payload), response.status]
    );
    console.log(new Date().toISOString(), "Snapshot saved; bytes:", Buffer.byteLength(raw), "interval ms:", INTERVAL);
  } catch (err) {
    try {
      await pool.query(
        "INSERT INTO odds_observations(captured_at,payload,error_text) VALUES($1,$2::jsonb,$3)",
        [capturedAt, JSON.stringify({ error: String(err.message || err) }), String(err.message || err).slice(0, 500)]
      );
    } catch (dbErr) { console.error("Unable to record collector error:", dbErr.message); }
    console.error("Collector poll failed:", err.message || err);
  }
}
async function main() {
  await ensureTable();
  console.log("NFL odds collector started. Poll interval:", INTERVAL, "ms");
  await poll(); // capture immediately on startup
  setInterval(poll, INTERVAL);
}
main().catch(err => { console.error(err); process.exit(1); });
process.on("SIGTERM", async () => { await pool.end(); process.exit(0); });
process.on("SIGINT", async () => { await pool.end(); process.exit(0); });
