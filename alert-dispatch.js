"use strict";

// One-user push dispatch primitive. Called only by the authenticated server worker.
// Game mute is checked before reserving a delivery and immediately before sends.
async function dispatchAlert({ pool, webpush, userId, alertId, kind, ticketId, gameId, payload }) {
  if (!pool || !webpush) throw new Error("Database and push sender are required");
  if (!userId || !alertId || !ticketId || !gameId || !payload) throw new Error("Alert fields are required");
  if (!["middle", "hedge"].includes(kind)) throw new Error("Invalid alert kind");
  const muted = await pool.query("SELECT 1 FROM tracker_muted_games WHERE user_id=$1 AND game_id=$2", [userId, String(gameId)]);
  if (muted.rowCount) return { status: "muted", sent: 0 };
  const reservation = await pool.query(
    `INSERT INTO tracker_alert_deliveries(user_id,alert_id,kind,ticket_id,game_id,payload,status)
     VALUES($1,$2,$3,$4,$5,$6::jsonb,'pending')
     ON CONFLICT(user_id,alert_id) DO NOTHING RETURNING alert_id`,
    [userId, String(alertId), kind, String(ticketId), String(gameId), JSON.stringify(payload)]
  );
  if (!reservation.rowCount) return { status: "duplicate", sent: 0 };
  const subs = await pool.query("SELECT endpoint,subscription FROM tracker_push_subscriptions WHERE user_id=$1", [userId]);
  let sent=0, failed=0;
  for (const row of subs.rows) {
    // Respect a mute that arrives while sending to a multi-device account.
    const nowMuted = await pool.query("SELECT 1 FROM tracker_muted_games WHERE user_id=$1 AND game_id=$2", [userId, String(gameId)]);
    if (nowMuted.rowCount) {
      await pool.query("UPDATE tracker_alert_deliveries SET status='failed',error_message='Muted before delivery completed',updated_at=NOW() WHERE user_id=$1 AND alert_id=$2 AND status='pending'",[userId,String(alertId)]);
      return { status: "muted", sent };
    }
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify({
        title: String(payload.title || "NFL Middle Tracker").slice(0,120),
        body: String(payload.body || "A tracked-game alert is available.").slice(0,1000),
        url: "/"
      }), { TTL: 90 });
      sent++;
    } catch (error) {
      failed++;
      if (error.statusCode === 404 || error.statusCode === 410) {
        await pool.query("DELETE FROM tracker_push_subscriptions WHERE user_id=$1 AND endpoint=$2",[userId,row.endpoint]);
      }
    }
  }
  const status = sent > 0 ? "sent" : "failed";
  await pool.query("UPDATE tracker_alert_deliveries SET status=$3,error_message=$4,updated_at=NOW(),sent_at=CASE WHEN $3='sent' THEN NOW() ELSE sent_at END WHERE user_id=$1 AND alert_id=$2 AND status='pending'",
    [userId,String(alertId),status,failed?failed+" device delivery attempt(s) failed":subs.rowCount?"No device accepted delivery":"No enrolled devices"]);
  return { status, sent, failed, total: subs.rowCount };
}
module.exports = { dispatchAlert };
