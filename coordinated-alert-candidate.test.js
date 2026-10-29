const assert=require("node:assert/strict");
const {buildCoordinatedAlertCandidate}=require("./coordinated-alert-candidate");
const record={id:"g-1",status:"tracking",minimumMiddlePoints:3,event:{league:"nfl",awayTeam:"A",homeTeam:"B"}};
const middle={middleWidth:4,pairedOriginal:{team:"A",spread:-3,stake:40,sportsbook:"Book1"},
 middleLegs:[{team:"B",spread:7,odds:-105,stake:5,sportsbook:"Book2",quoteId:"m1"}],
 outcomeSummary:{middleNet:{minNet:3,maxNet:8}}};
const hedge={originalTeam:"B",originalTeamName:"Team B",originalBook:"Book3",originalStake:40,
 recommendation:{leg:{team:"A",spread:-3,odds:100,stake:5,sportsbook:"Book1",quoteId:"h1"},summary:{worstNet:-2}}};
const candidate=buildCoordinatedAlertCandidate({record,preview:{ok:true,sportsbook:"multi",quoteCount:8,plan:{bestMiddle:middle,hedgeRecommendation:hedge}}});
assert.equal(candidate.eligible,true);
assert.equal(candidate.middle.width,4);
assert.equal(candidate.middle.leg.spread,7);
assert.equal(candidate.hedge.originalTeam,"B");
assert.notEqual(candidate.middle.leg.sportsbook,candidate.hedge.leg.sportsbook);
assert.ok(candidate.fingerprint);
assert.equal(buildCoordinatedAlertCandidate({record:{...record,status:"stopped"},preview:{ok:true,plan:{bestMiddle:middle}}}).eligible,false);
assert.equal(buildCoordinatedAlertCandidate({record,preview:{ok:false}}).reason,"preview-unavailable");
assert.equal(buildCoordinatedAlertCandidate({record,preview:{ok:true,plan:{bestMiddle:{...middle,middleWidth:2}}}}).reason,"no-qualifying-middle");
assert.equal(buildCoordinatedAlertCandidate({record,preview:{ok:true,plan:{bestMiddle:middle,hedgeRecommendation:{...hedge,recommendation:{...hedge.recommendation,leg:{...hedge.recommendation.leg,sportsbook:"Book2"}}}}}}).hedge,null,
 "same-book hedge must be withheld");
const revised={...middle,middleLegs:[{...middle.middleLegs[0],odds:-102}]};
const changed=buildCoordinatedAlertCandidate({record,preview:{ok:true,plan:{bestMiddle:revised,hedgeRecommendation:hedge}}});
assert.notEqual(candidate.fingerprint,changed.fingerprint,"price movement changes dedupe fingerprint");
console.log("coordinated alert candidate tests passed");
