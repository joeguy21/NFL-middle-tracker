/**
 * Normalize explicit FanLine NFL full-game spread selections.
 * Conservative: requires exactly two opposing selections and valid timestamps.
 */
const { normTeam } = require("./cross-feed-event-matcher");
function normalizeFanLineSpreads(payload,{teamA,teamB,sportsbook,nowMs,maxAgeMs=30000}={}) {
 if(!payload||!Array.isArray(payload.markets)) throw new Error("FanLine payload must contain a markets array.");
 if(!teamA||!teamB||normTeam(teamA)===normTeam(teamB)) throw new Error("Distinct Team A and Team B names are required.");
 if(!sportsbook||!String(sportsbook).trim()) throw new Error("Explicit sportsbook attribution is required.");
 const wanted=new Map([[normTeam(teamA),"A"],[normTeam(teamB),"B"]]),quotes=[];
 const first=(o,keys)=>{for(const k of keys)if(o&&o[k]!=null&&o[k]!=="")return o[k];return undefined;};
 for(const m of payload.markets){
  const league=String(first(m,["league","league_name","sport","sport_name"])||"").toLowerCase();
  const category=String(first(m,["category","market","market_name","market_type"])||"").toLowerCase();
  const period=String(first(m,["period","market_period"])||"").toLowerCase();
  if(!/(^|\b)nfl(\b|$)|football/.test(league)||!/spread|handicap/.test(category)||!["game","full game","full-game","match"].includes(period))continue;
  const eventTeams=[first(m,["away_team","awayTeam"]),first(m,["home_team","homeTeam"])].map(normTeam);
  if(!eventTeams.includes(normTeam(teamA))||!eventTeams.includes(normTeam(teamB)))continue;
  const rawTime=first(m,["updated_at","updatedAt","last_updated","lastUpdated","timestamp"]);
  const updated=Date.parse(rawTime);
  if(!Number.isFinite(updated)||(nowMs!=null&&(updated>nowMs||nowMs-updated>maxAgeMs)))continue;
  const selections=first(m,["selections","outcomes","prices"]);
  if(!Array.isArray(selections)||selections.length!==2)continue;
  const staged=[],seen=new Set();let invalid=false;
  for(const sel of selections){
   const team=wanted.get(normTeam(first(sel,["name","team","team_name","label"])));
   const spread=Number(first(sel,["handicap","spread","point"]));
   const odds=Number(first(sel,["american","american_odds","odds","price"]));
   const st=String(sel.status||"").toUpperCase();
   if(!team||seen.has(team)||(st&&!["ACTIVE","OPEN","PRE"].includes(st))||!Number.isFinite(spread)||!Number.isFinite(odds)||odds===0){invalid=true;break;}
   seen.add(team);staged.push({team,spread,odds,sportsbook:String(sportsbook).trim(),timestampMs:updated,quoteId:String(sel.selection_id||sel.id||""),marketId:String(m.market_id||m.marketId||""),eventId:String(m.event_id||m.eventId||""),event:m.event,period,category:"spread",marketType:m.market_type||m.marketType||m.market_name||"spread"});
  }
  if(invalid||seen.size!==2||Math.abs(staged[0].spread+staged[1].spread)>.001)continue;
  quotes.push(...staged);
 }
 return quotes;
}
module.exports={normalizeFanLineSpreads};
