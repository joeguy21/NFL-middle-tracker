const {previewCoordinatedPlan}=require("./coordinated-plan-preview");
const {buildCoordinatedAlertCandidate}=require("./coordinated-alert-candidate");
async function ensureAlertTable(pool){
 await pool.query(`CREATE TABLE IF NOT EXISTS coordinated_alerts(
 alert_id BIGSERIAL PRIMARY KEY,record_id TEXT NOT NULL REFERENCES tracker_records(record_id) ON DELETE CASCADE,
 fingerprint TEXT NOT NULL,candidate JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(record_id,fingerprint));
 CREATE INDEX IF NOT EXISTS coordinated_alerts_record_created_idx ON coordinated_alerts(record_id,created_at DESC);`);
}
async function evaluateAndStoreAlerts({pool,records,payload,nowMs=Date.now()}={}){
 await ensureAlertTable(pool);const stats={evaluated:0,created:0,unchanged:0,errors:0};
 for(const record of records||[]){
  if(record?.recordType!=="coordinated-game"||record.status!=="tracking")continue;
  stats.evaluated++;
  try{
   if(String(record.event?.league||"").toLowerCase()!=="nfl")continue;
   const preview=previewCoordinatedPlan({record,payload,nowMs,sportsbook:"FanDuel",maxAddedStake:300,maxTotalStake:500,maxQuoteAgeMs:30000});
   if(!preview.ok)continue;
   const candidate=buildCoordinatedAlertCandidate({record,preview,checkedAt:new Date(nowMs).toISOString()});
   if(!candidate.eligible)continue;
   const inserted=await pool.query("INSERT INTO coordinated_alerts(record_id,fingerprint,candidate) VALUES($1,$2,$3::jsonb) ON CONFLICT(record_id,fingerprint) DO NOTHING RETURNING alert_id",[record.id,candidate.fingerprint,JSON.stringify(candidate)]);
   if(inserted.rowCount)stats.created++;else stats.unchanged++;
  }catch(err){stats.errors++;console.error("Alert evaluation failed for",record.id,err.message||err);}
 }
 return stats;
}
module.exports={ensureAlertTable,evaluateAndStoreAlerts};
