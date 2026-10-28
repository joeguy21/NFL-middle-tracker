// Status-aware odds collector. Odds snapshots are batched through FanLine.
const {Pool}=require("pg");
const {nextPollDelay}=require("./odds-poll-scheduler");
const {matchGameStatus}=require("./game-status");
const API_KEY=process.env.FANLINE_API_KEY,DB=process.env.DATABASE_URL,BASE="https://api.fanlinewire.com";
const ESPN="https://site.api.espn.com/apis/site/v2/sports";
if(!API_KEY||!DB)throw new Error("Set FANLINE_API_KEY and DATABASE_URL.");
const pool=new Pool({connectionString:DB,ssl:process.env.PGSSLMODE==="disable"?false:{rejectUnauthorized:false},max:2});
let closing=false,timer=null,busy=false;
async function ensureTable(){await pool.query(`
CREATE TABLE IF NOT EXISTS odds_observations(
 observation_id BIGSERIAL PRIMARY KEY,captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 source_updated_at TIMESTAMPTZ,source TEXT NOT NULL DEFAULT 'FanLine board',
 league TEXT NOT NULL DEFAULT 'NFL',payload JSONB NOT NULL,request_status INTEGER,error_text TEXT);
CREATE INDEX IF NOT EXISTS odds_observations_captured_idx ON odds_observations(captured_at);`);}
async function activeRecords(){const r=await pool.query("SELECT record_id,payload FROM tracker_records WHERE record_type='coordinated-game' AND payload->>'status'='tracking'");return r.rows.map(x=>({id:x.record_id,...x.payload}));}
function espnPath(league){const v=String(league||"nfl").toLowerCase();if(v==="nfl")return "football/nfl";if(v==="nba")return "basketball/nba";return null;}
function dateKey(record){const t=Date.parse(record.event?.startTime);return Number.isFinite(t)?new Date(t).toISOString().slice(0,10).replace(/-/g,""):null;}
async function refreshGameStatuses(records){
 const now=Date.now(),groups=new Map();
 for(const record of records){
  const kickoff=Date.parse(record.event?.startTime);
  if(!Number.isFinite(kickoff)||kickoff-now>2*60*60*1000)continue;
  const path=espnPath(record.event?.league),date=dateKey(record);if(!path||!date)continue;
  const key=path+"|"+date;if(!groups.has(key))groups.set(key,{path,date,records:[]});groups.get(key).records.push(record);
 }
 let finalized=0;
 for(const group of groups.values()){
  try{
   const url=ESPN+"/"+group.path+"/scoreboard?dates="+group.date;
   const response=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error("Scoreboard status "+response.status);
   const board=await response.json();if(!Array.isArray(board.events))throw Error("Scoreboard response missing events");
   for(const record of group.records){
    const status=matchGameStatus(board.events,record);
    if(status.confirmedFinal){
     const updated={...record,status:"stopped",stoppedAt:new Date().toISOString(),gameStatus:"final",gameStatusSource:"ESPN scoreboard",gameStatusEventId:status.eventId,gameStatusCheckedAt:new Date().toISOString(),autoStoppedReason:"confirmed-final"};
     delete updated.record_id;
     const result=await pool.query("UPDATE tracker_records SET payload=$2::jsonb,updated_at=NOW() WHERE record_id=$1 AND record_type='coordinated-game' AND payload->>'status'='tracking'",[record.id,JSON.stringify(updated)]);
     if(result.rowCount){finalized++;console.log("Confirmed final; tracking stopped:",record.game||record.id);}
    }else{
     console.log("Game status",record.game||record.id,status.status,status.reason||status.sourceStatus||"");
    }
   }
  }catch(err){console.error("Game-status check failed; leaving records tracked:",group.path,group.date,err.message||err);}
 }
 return finalized;
}
function postgresSafeJson(value){
 if(typeof value==="string"){
  return value.replaceAll(String.fromCharCode(0),"�").replace(/[\\uD800-\\uDBFF](?![\\uDC00-\\uDFFF])|(?<![\\uD800-\\uDBFF])[\\uDC00-\\uDFFF]/g,"�");
 }
 if(Array.isArray(value))return value.map(postgresSafeJson);
 if(value&&typeof value==="object"){const out={};for(const [k,v] of Object.entries(value))out[postgresSafeJson(k)]=postgresSafeJson(v);return out;}
 return value;
}
async function captureOdds(){
 const capturedAt=new Date().toISOString();
 try{
  const response=await fetch(BASE+"/v1/board.json",{headers:{"x-api-key":API_KEY,Accept:"application/json"},signal:AbortSignal.timeout(20000)});
  const raw=await response.text();let payload;try{payload=JSON.parse(raw)}catch{payload={raw_text:raw.slice(0,1500000)}}
  payload=postgresSafeJson(payload);
  if(!response.ok){await pool.query("INSERT INTO odds_observations(captured_at,payload,request_status,error_text) VALUES($1,$2::jsonb,$3,$4)",[capturedAt,JSON.stringify(payload),response.status,"Provider request failed"]);console.error("Odds source status",response.status);return;}
  const sourceTime=payload&&(payload.updated_at||payload.last_updated||payload.timestamp);
  await pool.query("INSERT INTO odds_observations(captured_at,source_updated_at,payload,request_status) VALUES($1,$2,$3::jsonb,$4)",[capturedAt,sourceTime?new Date(sourceTime):null,JSON.stringify(payload),response.status]);
  console.log(new Date().toISOString(),"Odds snapshot saved; bytes:",Buffer.byteLength(raw));
 }catch(err){try{await pool.query("INSERT INTO odds_observations(captured_at,payload,error_text) VALUES($1,$2::jsonb,$3)",[capturedAt,JSON.stringify({error:String(err.message||err)}),String(err.message||err).slice(0,500)])}catch(dbErr){console.error("Unable to record collector error:",dbErr.message)}console.error("Odds poll failed:",err.message||err)}
}
async function cycle(){
 if(closing||busy)return;busy=true;let delay=60000;
 try{
  let records=await activeRecords();
  if(!records.length){console.log("No tracked games; odds requests paused.");}
  else{
   await refreshGameStatuses(records);
   records=await activeRecords();
   if(!records.length){console.log("All tracked games are final; odds requests paused.");}
   else{delay=nextPollDelay(records);await captureOdds();records=await activeRecords();delay=nextPollDelay(records);}
  }
 }catch(err){console.error("Collector cycle failed:",err.message||err);delay=60000}
 finally{busy=false;if(!closing)timer=setTimeout(cycle,delay);console.log("Next scheduler check in",Math.round(delay/1000),"seconds");}
}
async function main(){await ensureTable();console.log("Status-aware odds collector started.");await cycle();}
main().catch(e=>{console.error(e);process.exit(1)});
async function shutdown(){if(closing)return;closing=true;if(timer)clearTimeout(timer);while(busy)await new Promise(r=>setTimeout(r,100));await pool.end();process.exit(0)}
process.on("SIGTERM",shutdown);process.on("SIGINT",shutdown);
