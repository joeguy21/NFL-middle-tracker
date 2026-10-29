const assert = require("node:assert/strict");
const { optimizeSingleLegHedges } = require("./hedge-optimizer");
const { summarizePlan } = require("./hedge-calculator");

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
assert.equal(Math.round(result.best.leg.stake * 100), result.best.leg.stake * 100, "recommended hedge uses penny precision");
assert.equal(result.sizingMethod, "piecewise-linear intersection search at cent precision");
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
// Compare intersection search against brute-force cents over a small full window.
const benchmarkOriginals = [
  { team: "A", spread: -2.5, stake: 7.25, odds: -110 },
  { team: "B", spread: 2.5, stake: 8.10, odds: -105 }
];
const benchmarkCandidates = [
  { team: "B", spread: 5.5, odds: -115, sportsbook: "Book One" },
  { team: "A", spread: -1.5, odds: 102, sportsbook: "Book Two" }
];
const optimized = optimizeSingleLegHedges({
  originalLegs: benchmarkOriginals, candidates: benchmarkCandidates,
  maxAddedStake: 4, maxTotalStake: 100, stakeStep: 0.01
});
let exhaustiveWorst = -Infinity;
for (const quote of benchmarkCandidates) {
  for (let cents = 1; cents <= 400; cents++) {
    const outcome = summarizePlan(benchmarkOriginals, [{ ...quote, stake: cents / 100 }]);
    exhaustiveWorst = Math.max(exhaustiveWorst, outcome.worstNet);
  }
}
assert.equal(optimized.best.summary.worstNet, exhaustiveWorst,
  "intersection search must match brute-force cent optimum on benchmark cases");
console.log("Hedge optimizer smoke and cent-optimality tests passed.");
