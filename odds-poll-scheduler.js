const PRE_GAME_WINDOW_MS=2*60*60*1000;
const MINUTE_MS=60*1000;
const HOUR_MS=60*60*1000;
function nextPollDelay(records,now=Date.now()){
  const active=(records||[]).filter(r=>r&&r.recordType==="coordinated-game"&&r.status==="tracking");
  if(!active.length)return MINUTE_MS;
  let soonest=Infinity;
  for(const r of active){
    const t=Date.parse(r.event?.startTime);
    if(!Number.isFinite(t))return MINUTE_MS;
    const until=t-now;
    if(until<=PRE_GAME_WINDOW_MS)return MINUTE_MS;
    soonest=Math.min(soonest,until-PRE_GAME_WINDOW_MS);
  }
  return Math.max(MINUTE_MS,Math.min(HOUR_MS,soonest));
}
module.exports={nextPollDelay,PRE_GAME_WINDOW_MS,MINUTE_MS,HOUR_MS};
