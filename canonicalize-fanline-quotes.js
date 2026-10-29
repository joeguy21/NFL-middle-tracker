const { normalizeFanLineSpreads } = require("./fanline-spread-normalizer");
const { eventSignature, normTeam } = require("./cross-feed-event-matcher");

/**
 * Match selected scheduled game to one provider event, then retain all
 * legitimate spread markets belonging to that event (including alternate lines).
 * Candidate event identity uses provider event ID + normalized matchup + kickoff.
 */
function canonicalizeFanLineQuotes(payload, {
 selectedEvent,sportsbook,teamA,teamB,nowMs,maxAgeMs=30000,
 kickoffToleranceMs=8*60*60*1000
}={}) {
 if(!sportsbook||!String(sportsbook).trim())return [];
 const sig=eventSignature(selectedEvent);
 if(!sig)throw new Error("Selected game requires league, homeTeam, awayTeam, and valid startTime.");
 const wanted=[normTeam(selectedEvent.awayTeam),normTeam(selectedEvent.homeTeam)].sort();
 const groups=new Map();
 for(const m of payload?.markets||[]){
  const league=String(m.league||m.sport||"").toLowerCase();
  if(!/(^|\\b)nfl(\\b|$)|football/.test(league))continue;
  const pair=[normTeam(m.away_team),normTeam(m.home_team)].sort();
  if(pair[0]!==wanted[0]||pair[1]!==wanted[1])continue;
  const start=Date.parse(m.start_time);
  if(!Number.isFinite(start)||Math.abs(start-sig.start)>kickoffToleranceMs)continue;
  // Do not permit a date-crossing correction: catches wrong-day matches.
  if(new Date(start).toISOString().slice(0,10)!==new Date(sig.start).toISOString().slice(0,10))continue;
  const eventId=String(m.event_id||"");
  if(!eventId)continue;
  const id=eventId+"|"+pair.join("|")+"|"+start;
  if(!groups.has(id))groups.set(id,{eventId,start,marketIds:new Set()});
  const group=groups.get(id);
  if(m.market_id!=null)group.marketIds.add(String(m.market_id));
 }
 // A unique provider event is required; multiple market/alt-line rows within
 // that same event are expected and should not create false ambiguity.
 if(groups.size!==1)return [];
 const group=[...groups.values()][0];
 const quotes=normalizeFanLineSpreads(payload,{teamA,teamB,sportsbook,nowMs,maxAgeMs});
 const valid=quotes.filter(q=>group.marketIds.has(q.marketId));
 const key=`${sig.league}:${sig.teams.join("|")}:${sig.start}`;
 return valid.map(q=>({...q,eventId:key,league:sig.league,
  scheduledEvent:{league:sig.league,teams:sig.teams,startTime:new Date(sig.start).toISOString()},
  sourceEventId:q.eventId,sourceMarketId:q.marketId}));
}
module.exports={canonicalizeFanLineQuotes};
