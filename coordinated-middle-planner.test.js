const assert = require("node:assert/strict");
const { planMiddleFirst } = require("./coordinated-middle-planner");

const originals = [
  { team: "A", spread: -3, odds: 110, stake: 20, sportsbook: "FanDuel" },
  { team: "B", spread: 3, odds: 110, stake: 20, sportsbook: "DraftKings" }
];
const context = { eventId: "event-1", marketId: "market-1", league: "nfl", category: "spread", period: "game", marketType: "MATCH_HANDICAP_(2-WAY)" };
const quotes = [
  { ...context, team: "A", spread: -2.5, odds: -110, sportsbook: "FanDuel", quoteId: "blocked-A" },
  { ...context, team: "A", spread: -2.5, odds: -105, sportsbook: "BetMGM", quoteId: "eligible-A" },
  { ...context, team: "B", spread: 7, odds: -110, sportsbook: "DraftKings", quoteId: "blocked-B" },
  { ...context, team: "B", spread: 7, odds: -105, sportsbook: "FanDuel", quoteId: "eligible-B" }
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
    { ...context, team: "A", spread: -2.5, odds: -110, sportsbook: "FanDuel" },
    { ...context, team: "B", spread: 7, odds: -110, sportsbook: "FanDuel" }
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
    { ...context, team: "A", spread: -2.5, odds: -110, sportsbook: "BetMGM" },
    { ...context, team: "B", spread: 5, odds: -110, sportsbook: "FanDuel" }
  ],
  originalBooks: { A: "FanDuel", B: "DraftKings" },
  minMiddleWidth: 3,
  maxAddedStake: 20,
  maxTotalStake: 100,
  stakeStep: 10
});
assert.equal(narrow.best, null);

console.log("coordinated-middle-planner tests passed");

const otherEvent = planMiddleFirst({
  originalLegs: originals,
  quotes: [
    { ...context, team: "A", spread: -2.5, odds: -105, sportsbook: "BetMGM" },
    { ...context, eventId: "event-2", marketId: "market-2", team: "B", spread: 7, odds: -105, sportsbook: "FanDuel" }
  ],
  originalBooks: { A: "FanDuel", B: "DraftKings" },
  minMiddleWidth: 3, maxAddedStake: 20, maxTotalStake: 100, stakeStep: 10
});
assert.equal(otherEvent.best, null, "Quotes from different events must never pair");

const noIdentity = planMiddleFirst({
  originalLegs: originals,
  quotes: [
    { team: "A", spread: -2.5, odds: -105, sportsbook: "BetMGM" },
    { team: "B", spread: 7, odds: -105, sportsbook: "FanDuel" }
  ],
  originalBooks: { A: "FanDuel", B: "DraftKings" },
  minMiddleWidth: 3, maxAddedStake: 20, maxTotalStake: 100, stakeStep: 10
});
assert.equal(noIdentity.best, null, "Quotes without event/market identity must not pair");
