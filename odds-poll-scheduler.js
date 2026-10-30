const MINUTE_MS=60*1000;
const HOUR_MS=60*60*1000;
const STATUS_WATCH_WINDOW_MS=60*60*1000;
function isLive(r){return String(r?.gameStatus||"").toLowerCase()==="in-progress";}
function nextPollDelay(records,now=Date.now()){
 const active=(records||[]).filter(r=>r&&r.recordType==="coordinated-game"&&r.status==="tracking");
 if(!active.length)return HOUR_MS;
 if(active.some(isLive))return MINUTE_MS;
 for(const r of active){const t=Date.parse(r.event?.startTime);if(Number.isFinite(t)&&t-now<=STATUS_WATCH_WINDOW_MS)return MINUTE_MS;}
 return HOUR_MS;
}
module.exports={nextPollDelay,isLive,MINUTE_MS,HOUR_MS,STATUS_WATCH_WINDOW_MS};
