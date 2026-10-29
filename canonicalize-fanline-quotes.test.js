const assert = require("node:assert/strict");
const { canonicalizeFanLineQuotes } = require("./canonicalize-fanline-quotes");
const payload = {markets:[{
 market_id:"fd-market-44", event_id:"provider-id-abc", league:"nfl",
 event:"Carolina Panthers @ Green Bay Packers",
 away_team:"Carolina Panthers", home_team:"Green Bay Packers",
 start_time:"2026-10-30T00:16:00Z", period:"game", category:"spread",
 market_type:"MATCH_HANDICAP_(2-WAY)", status:"OPEN",
 updated_at:"2026-10-30T00:10:00Z",
 selections:[
  {selection_id:"a",name:"Carolina Panthers",handicap:3.5,status:"ACTIVE",american:-106},
  {selection_id:"b",name:"Green Bay Packers",handicap:-3.5,status:"ACTIVE",american:-114}
 ]
}]};
const selectedEvent = {league:"nfl",awayTeam:"CAR",homeTeam:"GB",startTime:"2026-10-30T00:16:00Z"};
const opts={selectedEvent,teamA:"Carolina Panthers",teamB:"Green Bay Packers",sportsbook:"FanDuel",nowMs:Date.parse("2026-10-30T00:10:05Z")};
const result=canonicalizeFanLineQuotes(payload,opts);
assert.equal(result.length,2);
assert.equal(result[0].eventId,result[1].eventId,"Both sides share canonical event identity");
assert.equal(result[0].sourceEventId,"provider-id-abc");
assert.equal(result[0].sportsbook,"FanDuel");
assert.equal(result[0].league,"nfl");
assert.equal(result[0].category,"spread");
assert.equal(result[0].period,"game");
assert.equal(result[0].marketType,"MATCH_HANDICAP_(2-WAY)");
assert.equal(result[0].eventId,result[1].eventId,"Planner grouping uses canonical event identity");
assert.equal(canonicalizeFanLineQuotes(payload,{...opts,selectedEvent:{...selectedEvent,startTime:"2026-10-30T02:00:00Z"}}).length,2,"Same UTC calendar date and kickoff offset within eight hours can bind");
assert.equal(canonicalizeFanLineQuotes(payload,{...opts,sportsbook:""}).length,0,"Missing attribution rejects upstream at normalization");
assert.throws(()=>canonicalizeFanLineQuotes(payload,{...opts,selectedEvent:{league:"nfl"}}),/Selected game requires/);
const ambiguous={markets:[...payload.markets,{...payload.markets[0],market_id:"second",event_id:"other",start_time:"2026-10-30T00:18:00Z"}]};
assert.equal(canonicalizeFanLineQuotes(ambiguous,opts).length,0,"Distinct provider events for the same matchup fail closed.");
const alternate={...payload.markets[0],market_id:"fd-alt-45",selections:[{selection_id:"alt-a",name:"Carolina Panthers",handicap:6.5,status:"ACTIVE",american:-120},{selection_id:"alt-b",name:"Green Bay Packers",handicap:-6.5,status:"ACTIVE",american:100}]};
const withAlternate={markets:[...payload.markets,alternate]};
assert.equal(canonicalizeFanLineQuotes(withAlternate,opts).length,4,"Distinct spread markets within one provider event remain available as alt lines.");
console.log("canonical FanLine quote binding tests passed");
