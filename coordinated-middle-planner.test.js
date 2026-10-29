const assert=require("node:assert/strict");
const {planMiddleFirst}=require("./coordinated-middle-planner");
const originals=[
 {team:"A",spread:-3,odds:-110,stake:100,sportsbook:"FanDuel"},
 {team:"B",spread:3,odds:-110,stake:100,sportsbook:"DraftKings"}
];
const ctx={eventId:"game",league:"nfl",category:"spread",period:"game",marketType:"two-way"};
const quotes=[
 {...ctx,team:"A",spread:-2.5,odds:-105,sportsbook:"BetMGM",quoteId:"a",timestampMs:10000},
 {...ctx,team:"B",spread:7,odds:-110,sportsbook:"Caesars",quoteId:"b",timestampMs:10000},
 {...ctx,team:"A",spread:-3,odds:100,sportsbook:"Hard Rock",quoteId:"hedgeA",timestampMs:10000},
 {...ctx,team:"B",spread:7,odds:-102,sportsbook:"DraftKings",quoteId:"blockedBook",timestampMs:10000}
];
const result=planMiddleFirst({originalLegs:originals,quotes,originalBooks:{A:"FanDuel",B:"DraftKings"},
 minMiddleWidth:3,stakeStep:0.01,nowMs:10000});
assert.ok(result.best,"should find qualifying middle");
assert.equal(result.best.middleLegs.length,1,"middle adds one live wager");
assert.ok(result.best.middleWidth>=3);
assert.ok(result.best.hedgeRecommendation,"the qualifying middle should include its corresponding hedge if a valid quote exists");
assert.notEqual(result.best.middleLegs[0].sportsbook.toLowerCase(),result.best.hedgeRecommendation.recommendation.leg.sportsbook.toLowerCase());
assert.equal(result.best.hedgeRecommendation.originalTeam,result.best.pairedOriginal.team==="A"?"B":"A",
 "hedge targets the other original ticket");
assert.equal(result.best.middleLegs[0].spread,7,"middle uses the available live line");
assert.equal(result.best.middleLegs[0].stake,result.best.pairedOriginal.stake,"middle stake starts equal to the paired original ticket");
assert.equal(Math.round(result.best.hedgeRecommendation.recommendation.leg.stake*100),result.best.hedgeRecommendation.recommendation.leg.stake*100,"hedge stake is represented to penny precision");
assert.equal(result.best.middleLegs[0].sportsbook,"Caesars","use top qualifying width offer");
assert.ok(result.best.summary.totalStaked>0,"recommendation should report its full portfolio turnover");
assert.equal(result.bestMiddle,result.best);
const noDifferentBook=planMiddleFirst({originalLegs:originals,
 quotes:[{...ctx,team:"B",spread:7,odds:-105,sportsbook:"BetMGM",timestampMs:10000},
 {...ctx,team:"A",spread:-3,odds:-110,sportsbook:"BetMGM",timestampMs:10000}],
 originalBooks:{A:"FanDuel",B:"DraftKings"},minMiddleWidth:3,stakeStep:0.01,nowMs:10000});
assert.ok(noDifferentBook.best);
assert.equal(noDifferentBook.hedgeRecommendation,null,"No separate-book hedge should be fabricated");
const tooNarrow=planMiddleFirst({originalLegs:originals,quotes:[{...ctx,team:"B",spread:5,odds:-105,sportsbook:"Caesars",timestampMs:10000}],
 originalBooks:{A:"FanDuel",B:"DraftKings"},minMiddleWidth:3,maxAddedStake:20,maxTotalStake:300,stakeStep:5,nowMs:10000});
assert.equal(tooNarrow.best,null,"threshold is per request");
const stale=planMiddleFirst({originalLegs:originals,quotes:[{...ctx,team:"B",spread:7,odds:-105,sportsbook:"Caesars",timestampMs:1000}],
 originalBooks:{A:"FanDuel",B:"DraftKings"},minMiddleWidth:3,maxAddedStake:20,maxTotalStake:300,stakeStep:5,nowMs:40000});
assert.equal(stale.best,null,"stale quote not allowed");
console.log("coordinated-middle-planner tests passed");
