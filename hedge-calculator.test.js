const assert = require("node:assert/strict");
const calc = require("./hedge-calculator");

// Plus odds: $100 at +120 wins $120 profit.
assert.equal(calc.profitOnAmericanOdds(100, 120), 120);
// Minus odds: $110 at -110 wins $100 profit.
assert.equal(calc.profitOnAmericanOdds(110, -110), 100);
// Spread pushes return stake (zero net profit/loss).
assert.equal(calc.settleLeg(3, { team: "A", spread: -3, stake: 50, odds: -110 }), 0);
// Team B +3.5 wins when A wins by 3.
assert.equal(calc.settleSpread(3, "B", 3.5), "win");
// Team A -3.5 loses when A wins by 3.
assert.equal(calc.settleSpread(3, "A", -3.5), "loss");
// Quarter-point spreads must not be silently settled as ordinary wins/losses.
assert.throws(() => calc.settleSpread(3, "A", -3.25), /split-stake settlement/);
assert.equal(calc.settleSpread(3, "A", -3.5), "loss");
// No proposed action preserves original wager outcomes.
const summary = calc.summarizePlan([{team:"A",spread:3.5,stake:100,odds:120}]);
assert.equal(summary.addedStake, 0);
assert.equal(summary.totalStaked, 100);
assert.equal(summary.rows.length, 121);
// The user-facing summary must include every wager and identify a true overlap.
// Opposing +3.5 legs both win only when the final margin is between -3 and +3.
const { summarizeAlertOutcomes } = require("./coordinated-alert-outcomes");
const originalLegs = [
  {team:"A",spread:-3,stake:100,odds:-110,sportsbook:"FanDuel"},
  {team:"B",spread:3,stake:100,odds:-110,sportsbook:"DraftKings"}
];
const middleLeg = {team:"B",spread:7,stake:100,odds:-110,sportsbook:"Caesars"};
const outcomes = summarizeAlertOutcomes(
  originalLegs,
  [middleLeg],
  middleLeg,
  originalLegs[0]
);
assert.ok(outcomes.middleNet);
assert.equal(outcomes.packageExposure.originalStake, 200);
assert.equal(outcomes.packageExposure.proposedStake, 100);
assert.equal(outcomes.packageExposure.totalStaked, 300);
assert.equal(outcomes.evaluatedMarginRange.scenarioCount, 201);
assert.ok(outcomes.outsideNet.teamAWin);
assert.ok(outcomes.outsideNet.teamBWin);
assert.equal(outcomes.modelingNotice.includes("not a complete settlement model"), true);
assert.equal(outcomes.worstOutsideLossEstimate, outcomes.hedgeCostIfMiddleMisses,
  "Legacy field mirrors modeled combined-package outside-middle loss estimate");
console.log("Settlement calculator and outcome-summary tests passed.");
