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

const otherMarket = planMiddleFirst({
  originalLegs: originals,
  quotes: [
    { ...context, team: "A", spread: -2.5, odds: -105, sportsbook: "BetMGM" },
    { ...context, marketId: "market-alt", team: "B", spread: 7, odds: -105, sportsbook: "FanDuel" }
  ],
  originalBooks: { A: "FanDuel", B: "DraftKings" },
  minMiddleWidth: 3, maxAddedStake: 20, maxTotalStake: 100, stakeStep: 10
});
assert.ok(otherMarket.best, "Provider-specific market IDs may differ when event and market context match");


for (const [field, value] of [
  ["league", "nba"],
  ["category", "moneyline"],
  ["period", "first-half"],
  ["marketType", "MATCH_HANDICAP_(3-WAY)"]
]) {
  const mismatch = planMiddleFirst({
    originalLegs: originals,
    quotes: [
      { ...context, team: "A", spread: -2.5, odds: -105, sportsbook: "BetMGM" },
      { ...context, [field]: value, team: "B", spread: 7, odds: -105, sportsbook: "FanDuel" }
    ],
    originalBooks: { A: "FanDuel", B: "DraftKings" },
    minMiddleWidth: 3, maxAddedStake: 20, maxTotalStake: 100, stakeStep: 10
  });
  assert.equal(mismatch.best, null, `Quotes with mismatched ${field} must not pair`);
}

const stale = planMiddleFirst({
  originalLegs: originals,
  quotes: [
    { ...context, team: "A", spread: -2.5, odds: -105, sportsbook: "BetMGM", timestampMs: 1000 },
    { ...context, team: "B", spread: 7, odds: -105, sportsbook: "FanDuel", timestampMs: 1000 }
  ],
  originalBooks: { A: "FanDuel", B: "DraftKings" },
  minMiddleWidth: 3, maxAddedStake: 20, maxTotalStake: 100, stakeStep: 10,
  nowMs: 40000, maxQuoteAgeMs: 30000
});
assert.equal(stale.best, null, "Stale quotes must not create a package");

const tightCap = planMiddleFirst({
  originalLegs: originals,
  quotes,
  originalBooks: { A: "FanDuel", B: "DraftKings" },
  minMiddleWidth: 3,
  maxAddedStake: 300,
  maxTotalStake: 45,
  stakeStep: 10
});
assert.equal(tightCap.best, null, "Planner must not create a package when original stakes leave insufficient room for both legs");

const constrained = planMiddleFirst({
  originalLegs: originals,
  quotes,
  originalBooks: { A: "FanDuel", B: "DraftKings" },
  minMiddleWidth: 3,
  maxAddedStake: 300,
  maxTotalStake: 55,
  stakeStep: 5
});
assert.ok(constrained.best, "A feasible package should fit within the remaining exposure");
assert.ok(constrained.best.middleLegs.length === 2);
assert.ok(constrained.best.summary.addedStake <= 15, "All proposed middle stakes must fit remaining total exposure");
assert.ok(constrained.best.summary.totalStaked <= 55, "Original plus every proposed leg must fit max total stake");
assert.equal(
  constrained.best.summary.totalOriginalStake,
  originals.reduce((sum, leg) => sum + leg.stake, 0),
  "Summary must include both original wagers"
);
assert.equal(
  constrained.best.summary.addedStake,
  constrained.best.legs.reduce((sum, leg) => sum + leg.stake, 0),
  "Added exposure must count every selected new leg"
);


// Verify a generated middle package settles as expected inside its modeled window.
const { evaluateMargin } = require("./hedge-calculator");
const middleMargin = 4; // Between Team A -2.5 and Team B +7.
const proposedNet = evaluateMargin(middleMargin, [
  ...originals,
  ...result.best.legs
]);
assert.ok(proposedNet > 0, "A qualifying middle outcome should show positive combined net in this fixture");

// Outside the middle, the package must still produce a finite, computable result.
for (const margin of [-20, -7, 0, 8, 20]) {
  const net = evaluateMargin(margin, [...originals, ...result.best.legs]);
  assert.ok(Number.isFinite(net), `Settlement result must be finite at margin ${margin}`);
}
