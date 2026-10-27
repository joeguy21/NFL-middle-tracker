const assert = require("node:assert/strict");
const { eligibleQuotes, isEligibleQuote } = require("./odds-eligibility");

const quotes = [
 {team:"A", spread:-3.5, odds:-110, sportsbook:"FanDuel"},
 {team:"A", spread:-3.5, odds:100, sportsbook:"Caesars"},
 {team:"B", spread:3.5, odds:-105, sportsbook:"DraftKings"},
 {team:"B", spread:3.5, odds:102, sportsbook:"FanDuel"}
];
// Book restrictions are team-specific, not global.
const got = eligibleQuotes(quotes, {A:"FanDuel", B:"DraftKings"});
assert.deepEqual(got.map(q=>q.sportsbook), ["Caesars", "FanDuel"]);
assert.equal(isEligibleQuote(quotes[0], {A:" fanduel "}), false);
assert.equal(isEligibleQuote(quotes[3], {A:"FanDuel"}), true);

// Unknown, malformed, or stale quotes must not be action candidates.
assert.equal(isEligibleQuote({...quotes[1], odds:0}), false);
assert.equal(isEligibleQuote(quotes[1], {}, {nowMs:100000, maxQuoteAgeMs:30000}), false);
assert.equal(isEligibleQuote({...quotes[1], timestampMs:95000}, {}, {nowMs:100000, maxQuoteAgeMs:30000}), true);
console.log("Odds eligibility tests passed.");
