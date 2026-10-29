const assert = require("node:assert/strict");
const { previewCoordinatedPlan } = require("./coordinated-plan-preview");
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
const record = {
 event:{league:"nfl",awayTeam:"CAR",homeTeam:"GB",teamA:"Carolina Panthers",teamB:"Green Bay Packers",startTime:"2026-10-30T00:16:00Z"},
 minimumMiddlePoints:3,
 originalLegs:[
  {team:"A",spread:7.5,odds:-110,stake:100,sportsbook:"DraftKings"},
  {team:"B",spread:-7.5,odds:-110,stake:100,sportsbook:"Hard Rock Bet"}
 ]
};
const nowMs=Date.parse("2026-10-30T00:10:05Z");
const result=previewCoordinatedPlan({record,payload,nowMs});
assert.equal(result.ok,true);
assert.equal(result.sportsbook,"FanDuel","FanLine is not attributed to other books");
assert.equal(result.quoteCount,2);
assert.equal(result.minimumMiddlePoints,3);
assert.equal(typeof result.plan.qualifyingPackages,"number");
assert.ok(Array.isArray(result.plan.alternatives));
if (result.plan.best) {
  assert.ok(result.plan.best.outcomeSummary,"Any recommended package includes modeled outcomes");
  assert.equal(result.plan.best.outcomeSummary.evaluatedMarginRange.scenarioCount,201);
  assert.ok(result.plan.best.outcomeSummary.outsideNet,"Outside-middle results are split out");
}
assert.ok(result.plan.alternatives.every(option=>option.outcomeSummary),"Every alternative includes modeled outcomes");
assert.equal(previewCoordinatedPlan({record,payload,nowMs:nowMs+60000}).ok,false,"Stale prices fail closed");
assert.equal(previewCoordinatedPlan({record,payload,nowMs, sportsbook:""}).ok,false,"Missing attribution cannot create a preview");
assert.throws(()=>previewCoordinatedPlan({record:{...record,originalLegs:[record.originalLegs[0]]},payload,nowMs}),/exactly two/);
assert.throws(()=>previewCoordinatedPlan({record:{...record,originalLegs:record.originalLegs.map((leg,i)=>i===0?{...leg,spread:7.25}:leg)},payload,nowMs}),/split-stake settlement/);
const mismatch={markets:payload.markets.map(m=>({...m,away_team:"New England Patriots"}))};
assert.equal(previewCoordinatedPlan({record,payload:mismatch,nowMs}).ok,false,"Mismatch fails closed");
console.log("coordinated plan preview tests passed");
