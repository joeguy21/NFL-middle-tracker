const assert = require("node:assert/strict");
const { summarizeAlertOutcomes } = require("./coordinated-alert-outcomes");

const original = [
  { team: "A", spread: -3, odds: 110, stake: 20, sportsbook: "FanDuel" },
  { team: "B", spread: 3, odds: 110, stake: 20, sportsbook: "DraftKings" }
];
const middleLeg = { team: "B", spread: 4.5, odds: -110, stake: 5, sportsbook: "Caesars" };
const pairedOriginal = original[0];
const packageLegs = [middleLeg, {team:"A",spread:-2.5,odds:-105,stake:10,sportsbook:"BetMGM"}];
const result = summarizeAlertOutcomes(original, packageLegs, middleLeg, pairedOriginal);
assert.ok(result.middleNet);
assert.equal(typeof result.hedgeComparison.worstOutsideBeforeHedge, "number");
assert.equal(typeof result.hedgeComparison.worstOutsideWithProposedPackage, "number");
assert.equal(result.hedgeComparison.modeledWorstCaseImprovement,
  Math.round((result.hedgeComparison.worstOutsideWithProposedPackage - result.hedgeComparison.worstOutsideBeforeHedge) * 100) / 100);
assert.deepEqual(result.packageExposure, {
  originalStake: 40, proposedStake: 15, totalStaked: 55,
  note: "Total staked is turnover across all legs, not net risk or worst-case loss."
});
assert.ok(result.outsideNet.teamAWin);
assert.ok(result.outsideNet.teamBWin);
assert.equal(result.evaluatedMarginRange.scenarioCount, 201);
assert.equal(result.hedgeCostIfMiddleMisses, Math.max(0, -result.worstOutsideNet));
assert.ok(result.modelingNotice.includes("integer margins"));
assert.ok(Array.isArray(result.pushMargins));
assert.throws(() => summarizeAlertOutcomes([], packageLegs, middleLeg, pairedOriginal), /required/);
assert.throws(() => summarizeAlertOutcomes(original, packageLegs, middleLeg, {team:"A",spread:-9,stake:1,sportsbook:"Other"}), /paired original/);
const noHedge = summarizeAlertOutcomes(original, [middleLeg], middleLeg, pairedOriginal);
assert.equal(noHedge.packageExposure.proposedStake, 5);
assert.equal(noHedge.packageExposure.totalStaked, 45);
const highLine = summarizeAlertOutcomes(
  [...original, {team:"A", spread:140.5, odds:-110, stake:1, sportsbook:"Test"}],
  packageLegs, middleLeg, pairedOriginal
);
assert.equal(highLine.evaluatedMarginRange.min, -143);
assert.equal(highLine.evaluatedMarginRange.max, 143);
assert.equal(highLine.evaluatedMarginRange.scenarioCount, 287);
console.log("coordinated-alert-outcomes tests passed");
