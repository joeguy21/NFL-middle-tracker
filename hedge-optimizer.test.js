const assert = require("node:assert/strict");
const { optimizeSingleLegHedges } = require("./hedge-optimizer");

const result = optimizeSingleLegHedges({
  originalLegs: [{ team: "A", spread: -3.5, stake: 100, odds: -110 }],
  candidates: [
    { team: "B", spread: 3.5, odds: -110, sportsbook: "Example Book" },
    { team: "A", spread: 7.5, odds: 100, sportsbook: "Example Book 2" }
  ],
  maxAddedStake: 80,
  maxTotalStake: 175,
  stakeStep: 5
});
assert.ok(result.best, "should find an allowed candidate");
assert.ok(result.best.leg.stake <= 75, "must honor max total exposure after original stake");
assert.ok(result.best.leg.stake > 0);
assert.ok(result.evaluated > 0);
assert.ok(result.best.summary.rows.every(r => Number.isFinite(r.net)));

const capped = optimizeSingleLegHedges({
  originalLegs: [{ team: "A", spread: 0, stake: 100, odds: 100 }],
  candidates: [{ team: "B", spread: 0, odds: 100 }],
  maxAddedStake: 100,
  maxTotalStake: 100,
  stakeStep: 1
});
assert.equal(capped.best, null, "no additional exposure allowed at cap");
console.log("Hedge optimizer smoke tests passed.");
