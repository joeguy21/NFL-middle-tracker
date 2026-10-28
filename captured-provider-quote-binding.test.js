const assert=require("node:assert/strict");
const {canonicalizeFanLineQuotes}=require("./canonicalize-fanline-quotes");

// Representative record shape captured from the detailed NJ spread endpoint.
// betslip_url attribution in this provider response identifies FanDuel.
const payload={markets:[{
 market_id:"734.192676872",event_id:"36215324",league:"nfl",
 event:"New England Patriots @ Miami Dolphins",
 away_team:"New England Patriots",home_team:"Miami Dolphins",
 start_time:"2026-11-01T18:00:00.000Z",market_name:"Spread",
 market_type:"MATCH_HANDICAP_(2-WAY)",period:"game",category:"spread",
 status:"OPEN",inplay:false,updated_at:"2026-10-28T18:06:13.397Z",
 selections:[
  {selection_id:"50204",name:"New England Patriots",handicap:-7,status:"ACTIVE",american:-105,betslip_url:"https://nj.sportsbook.fanduel.com/addToBetslip?marketId=734.192676872&selectionId=50204"},
  {selection_id:"50201",name:"Miami Dolphins",handicap:7,status:"ACTIVE",american:-115,betslip_url:"https://nj.sportsbook.fanduel.com/addToBetslip?marketId=734.192676872&selectionId=50201"}
 ]}]};
const selectedEvent={league:"nfl",awayTeam:"New England Patriots",homeTeam:"Miami Dolphins",startTime:"2026-11-01T18:00:00.000Z"};
const opts={selectedEvent,teamA:"New England Patriots",teamB:"Miami Dolphins",sportsbook:"FanDuel",nowMs:Date.parse("2026-10-28T18:06:20.000Z")};
const quotes=canonicalizeFanLineQuotes(payload,opts);
assert.equal(quotes.length,2);
assert.deepEqual(quotes.map(q=>q.team).sort(),["A","B"]);
assert.deepEqual(quotes.map(q=>q.spread).sort((a,b)=>a-b),[-7,7]);
assert.ok(quotes.every(q=>q.sportsbook==="FanDuel"));
assert.equal(quotes[0].eventId,quotes[1].eventId);
assert.ok(quotes.every(q=>q.sourceMarketId==="734.192676872"));
assert.equal(canonicalizeFanLineQuotes(payload,{...opts,nowMs:Date.parse("2026-10-28T18:07:00Z")}).length,0,"Old quotes are excluded");
assert.equal(canonicalizeFanLineQuotes(payload,{...opts,selectedEvent:{...selectedEvent,awayTeam:"New York Jets"}}).length,0,"Different matchup is excluded");
console.log("captured provider-schema quote binding tests passed");
