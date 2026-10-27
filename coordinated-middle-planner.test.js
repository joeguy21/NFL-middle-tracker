const assert = require("node:assert/strict");
const { planMiddleFirst } = require("./coordinated-middle-planner");

const originals = [
  { team: "A", spread: -3, odds: 110, stake: 20, sportsbook: "FanDuel" },
  { team: "B", spread: 3, odds: 110, stake: 20, sportsbook: "DraftKings" }
];
const quotes = [
  { team: "A", spread: -2.5, odds: -110, sportsbook: "FanDuel", quoteId: "blocked-A" },
  { team: "A", spread: -2.5, odds: -105, sportsbook: "BetMGM", quoteId: "eligible-A" },
  { team: "B", spread: 7, odds: -110, sportsbook: "DraftKings", quoteId: "blocked-B" },
  { team: "B", spread: 7, odds: -105, sportsbook: "FanDuel", quoteId: "eligible-B" }
];

const result = planMiddleFirst({
  originalLegs: originals,
  quotes,
  originalBooks: { A: "FanDuel", B: "DraftKings" },
  minMiddleWidth: 3,
  maxAddedStake: 20,
  maxTotalStake: 100,
  stakeStep: 10
});
assert.ok(result.best, "Should find a qualifying middle package");
assert.equal(result.best.middleWidth, 4.5);
assert.equal(result.best.middleLegs[0].sportsbook, "BetMGM", "Original Team A book must be excluded");
assert.equal(result.best.middleLegs[1].sportsbook, "FanDuel", "Team B may use Team A's original book");
assert.ok(result.best.summary.addedStake <= 20);
assert.ok(result.best.summary.totalStaked <= 100);

// Team-specific exclusion: if all available Team A offers are from its blocked book,
// no qualifying middle should be generated.
const blockedOnly = planMiddleFirst({
  originalLegs: originals,
  quotes: [
    { team: "A", spread: -2.5, odds: -110, sportsbook: "FanDuel" },
    { team: "B", spread: 7, odds: -110, sportsbook: "FanDuel" }
  ],
  originalBooks: { A: "FanDuel", B: "DraftKings" },
  minMiddleWidth: 3,
  maxAddedStake: 20,
  maxTotalStake: 100,
  stakeStep: 10
});
assert.equal(blockedOnly.best, null);

// Quotes below the configured width do not qualify.
const narrow = planMiddleFirst({
  originalLegs: originals,
  quotes: [
    { team: "A", spread: -2.5, odds: -110, sportsbook: "BetMGM" },
    { team: "B", spread: 5, odds: -110, sportsbook: "FanDuel" }
  ],
  originalBooks: { A: "FanDuel", B: "DraftKings" },
  minMiddleWidth: 3,
  maxAddedStake: 20,
  maxTotalStake: 100,
  stakeStep: 10
});
assert.equal(narrow.best, null);

console.log("coordinated-middle-planner tests passed");
