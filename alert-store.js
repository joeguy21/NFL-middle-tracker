"use strict";

// Durable, per-user alert delivery ledger. PostgreSQL uniqueness is the
// cross-process idempotency boundary; in-memory suppression is insufficient.
async function reserveAlert(pool, { userId, alertId, kind, ticketId, gameId, payload }) {
  if (!userId || !alertId || !kind || !ticketId || !gameId || !payload) throw new Error("Complete alert identity and payload required");
  const result = await pool.query(
    `INSERT INTO tracker_alert_deliveries(user_id,alert_id,kind,ticket_id,game_id,payload,status)
     VALUES($1,$2,$3,$4,$5,$6::jsonb,'pending')
     ON CONFLICT(user_id,alert_id) DO NOTHING
     RETURNING alert_id`,
    [userId, alertId, kind, ticketId, gameId, JSON.stringify(payload)]
  );
  return result.rowCount === 1;
}

async function markAlert(pool, { userId, alertId, status, error = null }) {
  if (!["sent", "failed"].includes(status)) throw new Error("Invalid alert delivery status");
  const result = await pool.query(
    `UPDATE tracker_alert_deliveries SET status=$3, error_message=$4,
       updated_at=NOW(), sent_at=CASE WHEN $3='sent' THEN NOW() ELSE sent_at END
     WHERE user_id=$1 AND alert_id=$2 AND status='pending'`,
    [userId, alertId, status, error ? String(error).slice(0, 500) : null]
  );
  return result.rowCount === 1;
}

module.exports = { reserveAlert, markAlert };
