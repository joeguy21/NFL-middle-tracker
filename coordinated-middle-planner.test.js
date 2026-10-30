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
const pairedInput=originals.find(x=>x.team===result.best.pairedOriginal.team);
assert.equal(result.best.middleLegs[0].stake,Math.round((pairedInput.odds>0 ? pairedInput.stake*pairedInput.odds/100 : pairedInput.stake*100/Math.abs(pairedInput.odds))*100)/100,"middle stake targets paired original ticket win profit");
assert.equal(Math.round(result.best.hedgeRecommendation.recommendation.leg.stake*100),result.best.hedgeRecommendation.recommendation.leg.stake*100,"hedge stake is represented to penny precision");
assert.equal(result.best.middleLegs[0].sportsbook,"Caesars","use top qualifying width offer");
assert.ok(result.best.summary.totalStaked>0,"recommendation should report its full portfolio turnover");
assert.equal(result.best.middleLegs[0].stake,90.91,"$100 at -110 pairs with $90.91 on the opposing middle leg to offset win profit when it loses");
assert.equal(result.bestMiddle,result.best);
const noDifferentBook=planMiddleFirst({originalLegs:originals,
 quotes:[{...ctx,team:"B",spread:7,odds:-105,sportsbook:"BetMGM",timestampMs:10000},
 {...ctx,team:"A",spread:-3,odds:-110,sportsbook:"BetMGM",timestampMs:10000}],
 originalBooks:{A:"FanDuel",B:"DraftKings"},minMiddleWidth:3,stakeStep:0.01,nowMs:10000});
assert.ok(noDifferentBook.best);
assert.equal(noDifferentBook.hedgeRecommendation,null,"No separate-book hedge should be fabricated");
const tooNarrow=planMiddleFirst({originalLegs:originals,quotes:[{...ctx,team:"B",spread:5,odds:-105,sportsbook:"Caesars",timestampMs:10000}],
 originalBooks:{A:"FanDuel",B:"DraftKings"},minMiddleWidth:3,stakeStep:0.01,nowMs:10000});
assert.equal(tooNarrow.best,null,"threshold is per request");
const stale=planMiddleFirst({originalLegs:originals,quotes:[{...ctx,team:"B",spread:7,odds:-105,sportsbook:"Caesars",timestampMs:1000}],
 originalBooks:{A:"FanDuel",B:"DraftKings"},minMiddleWidth:3,stakeStep:0.01,nowMs:40000});
assert.equal(stale.best,null,"stale quote not allowed");

const sampleOriginals=[
 {team:"A",spread:3.5,odds:113,stake:10,sportsbook:"FanDuel",teamName:"Carolina"},
 {team:"B",spread:-5.5,odds:107,stake:10,sportsbook:"DraftKings",teamName:"Green Bay"}
];
const sampleQuotes=[
 {...ctx,team:"A",spread:10.5,odds:-112,sportsbook:"Caesars",quoteId:"live-middle",timestampMs:10000},
 {...ctx,team:"B",spread:-3.5,odds:-400,sportsbook:"FanDuel",quoteId:"live-hedge",timestampMs:10000}
];
const sample=planMiddleFirst({originalLegs:sampleOriginals,quotes:sampleQuotes,
 originalBooks:{A:"FanDuel",B:"DraftKings"},minMiddleWidth:4,stakeStep:.01,nowMs:10000});
assert.ok(sample.best,"the 4+ point middle should qualify");
assert.equal(sample.best.pairedOriginal.team,"B","Panthers +10.5 should pair with original Packers -5.5");
assert.equal(sample.best.middleLegs[0].stake,10.70,"$10 Packers +107 original profit is $10.70, which sets middle sizing");
assert.equal(sample.best.middleLegs[0].spread,10.5);
assert.equal(sample.best.hedgeRecommendation.originalTeam,"A","the separate hedge must target original Panthers +3.5");
assert.equal(sample.best.hedgeRecommendation.recommendation.leg.spread,-3.5);
assert.equal(sample.best.hedgeRecommendation.recommendation.leg.odds,-400);
assert.ok(sample.best.hedgeRecommendation.recommendation.leg.stake>0,
 "the independent hedge leg must have a positive recommended stake");

console.log("coordinated-middle-planner tests passed");
