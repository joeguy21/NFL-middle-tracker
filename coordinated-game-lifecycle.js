/**
 * Coordinated tracked-game record lifecycle (pure functions).
 * Persistence/UI adapters must call these and save returned records explicitly.
 */
const VALID_BOOKS = new Set(["fanduel","draftkings","hard rock bet","betmgm","polymarket","fanatics"]);
function validLeg(leg) {
  return !!leg && ["A","B"].includes(leg.team) &&
    typeof leg.teamName==="string" && leg.teamName.trim().length>0 &&
    Number.isFinite(leg.spread) && Number.isFinite(leg.odds) && leg.odds!==0 &&
    Number.isFinite(leg.stake) && leg.stake>0 &&
    VALID_BOOKS.has(String(leg.sportsbook||"").trim().toLowerCase());
}
function createCoordinatedGame({id,event,legs,createdAt=new Date().toISOString()}={}) {
  if (typeof id!=="string" || !id.trim() || !event ||
      !["nfl","nba"].includes(String(event.league||"").trim().toLowerCase()) ||
      typeof event.homeTeam!=="string" || !event.homeTeam.trim() ||
      typeof event.awayTeam!=="string" || !event.awayTeam.trim() ||
      event.homeTeam.trim().toLowerCase()===event.awayTeam.trim().toLowerCase() ||
      !event.startTime || !Number.isFinite(Date.parse(event.startTime)))
    throw new Error("Record requires a valid ID and scheduled NFL/NBA matchup.");
  if (!Array.isArray(legs)||legs.length!==2||!legs.every(validLeg)||
      new Set(legs.map(x=>x.team)).size!==2)
    throw new Error("Enter valid original wagers for Team A and Team B.");
  const scheduled=new Set([event.homeTeam.trim().toLowerCase(),event.awayTeam.trim().toLowerCase()]);
  if (legs.some(l=>!scheduled.has(l.teamName.trim().toLowerCase())) ||
      new Set(legs.map(l=>l.teamName.trim().toLowerCase())).size!==2)
    throw new Error("Each original wager must match a different team in the scheduled game.");
  return {
    id:id.trim(),recordType:"coordinated-game",event:{...event},
    originalLegs:legs.map(l=>({...l,teamName:l.teamName.trim(),sportsbook:l.sportsbook.trim()})),
    status:"tracking",createdAt,trackingStartedAt:createdAt,stoppedAt:null,acceptedPlanId:null
  };
}
function startTracking(record, {now=new Date().toISOString()}={}) {
  if (!record || record.recordType!=="coordinated-game") throw new Error("Not a coordinated game record.");
  if (record.status==="tracking") return {...record};
  if (record.status!=="saved-not-tracking") throw new Error("Only saved games can start tracking.");
  return {...record,status:"tracking",trackingStartedAt:now,stoppedAt:null};
}
function stopTracking(record,{now=new Date().toISOString()}={}) {
  if (!record || record.recordType!=="coordinated-game"||record.status!=="tracking")
    throw new Error("Only active tracking can be stopped.");
  return {...record,status:"stopped",stoppedAt:now};
}
module.exports={createCoordinatedGame,startTracking,stopTracking};
