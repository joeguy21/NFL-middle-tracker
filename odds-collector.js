// Status-aware odds collector. Schedule is centralized; odds requests are batched via the provider board.
const {Pool}=require("pg");
const {nextPollDelay}=require("./odds-poll-scheduler");
const API_KEY=process.env.FANLINE_API_KEY,DB=process.env.DATABASE_URL,BASE="https://api.fanlinewire.com";
if(!API_KEY||!DB)throw new Error("Set FANLINE_API_KEY and DATABASE_URL.");
const pool=new Pool({connectionString:DB,ssl:process.env.PGSSLMODE==="disable"?false:{rejectUnauthorized:false},max:2});
let closing=false,timer=null,busy=false;
async function ensureTable(){await pool.query(`
CREATE TABLE IF NOT EXISTS odds_observations(
 observation_id BIGSERIAL PRIMARY KEY,captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 source_updated_at TIMESTAMPTZ,source TEXT NOT NULL DEFAULT 'FanLine board',
 league TEXT NOT NULL DEFAULT 'NFL',payload JSONB NOT NULL,request_status INTEGER,error_text TEXT);
CREATE INDEX IF NOT EXISTS odds_observations_captured_idx ON odds_observations(captured_at);`);}
async function activeRecords(){const r=await pool.query("SELECT payload FROM tracker_records WHERE record_type='coordinated-game' AND payload->>'status'='tracking'");return r.rows.map(x=>x.payload);}
async function captureOdds(){
 const capturedAt=new Date().toISOString();
 try{
  const response=await fetch(BASE+"/v1/board.json",{headers:{"x-api-key":API_KEY,Accept:"application/json"},signal:AbortSignal.timeout(20000)});
  const raw=await response.text();let payload;try{payload=JSON.parse(raw)}catch{payload={raw_text:raw.slice(0,1500000)}}
  if(!response.ok){await pool.query("INSERT INTO odds_observations(captured_at,payload,request_status,error_text) VALUES($1,$2::jsonb,$3,$4)",[capturedAt,JSON.stringify(payload),response.status,"Provider request failed"]);console.error("Odds source status",response.status);return;}
  const sourceTime=payload&&(payload.updated_at||payload.last_updated||payload.timestamp);
  await pool.query("INSERT INTO odds_observations(captured_at,source_updated_at,payload,request_status) VALUES($1,$2,$3::jsonb,$4)",[capturedAt,sourceTime?new Date(sourceTime):null,JSON.stringify(payload),response.status]);
  console.log(new Date().toISOString(),"Odds snapshot saved; bytes:",Buffer.byteLength(raw));
 }catch(err){try{await pool.query("INSERT INTO odds_observations(captured_at,payload,error_text) VALUES($1,$2::jsonb,$3)",[capturedAt,JSON.stringify({error:String(err.message||err)}),String(err.message||err).slice(0,500)])}catch(dbErr){console.error("Unable to record collector error:",dbErr.message)}console.error("Odds poll failed:",err.message||err)}
}
async function cycle(){
 if(closing||busy)return;busy=true;let delay=60000;
 try{
  const records=await activeRecords();
  if(!records.length){console.log("No tracked games; odds requests paused.");}
  else{delay=nextPollDelay(records);await captureOdds();const latest=await activeRecords();delay=nextPollDelay(latest);}
 }catch(err){console.error("Collector cycle failed:",err.message||err);delay=60000}
 finally{busy=false;if(!closing)timer=setTimeout(cycle,delay);console.log("Next scheduler check in",Math.round(delay/1000),"seconds");}
}
async function main(){await ensureTable();console.log("Status-aware odds collector started.");await cycle();}
main().catch(e=>{console.error(e);process.exit(1)});
async function shutdown(){if(closing)return;closing=true;if(timer)clearTimeout(timer);while(busy)await new Promise(r=>setTimeout(r,100));await pool.end();process.exit(0)}
process.on("SIGTERM",shutdown);process.on("SIGINT",shutdown);
