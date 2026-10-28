const assert = require("node:assert/strict");
const { normalizeFanLineSpreads } = require("./fanline-spread-normalizer");
const sample = {
  ok: true, state: "nj", markets: [{
    market_id: "m-1", event_id: "e-1", league: "nfl",
    event: "Carolina Panthers @ Green Bay Packers",
    away_team: "Carolina Panthers", home_team: "Green Bay Packers",
    period: "game", category: "spread", market_type: "MATCH_HANDICAP_(2-WAY)",
    status: "OPEN", updated_at: "2026-10-27T09:09:32.683Z",
    selections: [
      { selection_id: "sel-a", name: "Carolina Panthers", handicap: 3.5, status: "ACTIVE", american: -106 },
      { selection_id: "sel-b", name: "Green Bay Packers", handicap: -3.5, status: "ACTIVE", american: -114 }
    ]
  }]
};
const opts = { teamA: "Carolina Panthers", teamB: "Green Bay Packers", sportsbook: "FanDuel", nowMs: Date.parse("2026-10-27T09:09:40Z") };
const qs = normalizeFanLineSpreads(sample, opts);
assert.equal(qs.length, 2);
assert.deepEqual(qs.map(q => [q.team, q.spread, q.odds]), [["A", 3.5, -106], ["B", -3.5, -114]]);
assert.ok(qs.every(q => q.sportsbook === "FanDuel" && q.eventId === "e-1"));
assert.equal(normalizeFanLineSpreads(sample, {...opts, nowMs: Date.parse("2026-10-27T09:10:30Z")}).length, 0);
assert.equal(normalizeFanLineSpreads(sample, {...opts, nowMs: Date.parse("2026-10-27T09:09:30Z")}).length, 0);
assert.throws(() => normalizeFanLineSpreads(sample, {teamA:"A",teamB:"B"}), /sportsbook attribution/);
const mismatched = structuredClone(sample);
mismatched.markets[0].selections[1].handicap = 3.5;
assert.equal(normalizeFanLineSpreads(mismatched, opts).length, 0, "Reject markets with inconsistent opposing spread lines.");
const closed = structuredClone(sample); closed.markets[0].status = "CLOSED";
assert.equal(normalizeFanLineSpreads(closed, opts).length, 0);
const pregame = structuredClone(sample);
pregame.markets[0].status = "PRE";
pregame.markets[0].market_type = "HANDICAP";
pregame.markets[0].selections[0].handicap = "3.5";
pregame.markets[0].selections[1].handicap = "-3.5";
assert.equal(normalizeFanLineSpreads(pregame, opts).length, 2,
  "Accept provider PRE status, alternate handicap label, and numeric-string spreads");
console.log("FanLine spread normalizer tests passed");

const quarterMismatch = structuredClone(sample);
quarterMismatch.markets[0].selections[0].handicap = 3;
assert.equal(normalizeFanLineSpreads(quarterMismatch, opts).length, 0, "Reject non-opposite full-game spread selections.");
