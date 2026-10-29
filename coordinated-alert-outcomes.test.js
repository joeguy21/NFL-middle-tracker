const assert = require("node:assert/strict");
const { summarizeAlertOutcomes } = require("./coordinated-alert-outcomes");

const middle = [
  { team: "A", spread: -2.5, odds: -110, stake: 100, sportsbook: "DraftKings" },
  { team: "B", spread: 4.5, odds: -110, stake: 100, sportsbook: "FanDuel" }
];
const original = [
  { team: "A", spread: -3, odds: 110, stake: 20, sportsbook: "FanDuel" },
  { team: "B", spread: 3, odds: 110, stake: 20, sportsbook: "DraftKings" }
];
const result = summarizeAlertOutcomes(original, middle, middle);
assert.ok(result.middleNet);
assert.ok(result.middleNet.minNet > result.outsideNet.teamAWin.minNet);
assert.ok(result.outsideNet.teamAWin);
assert.ok(result.outsideNet.teamBWin);
assert.deepEqual(result.outsideNet.tie, { minNet: -7.09, maxNet: -7.09, margins: [0] }, "The tied-score scenario should preserve the modeled combined net.");
assert.equal(result.middlePushNet, null, "Half-point middle lines have no push scenarios in the integer-margin model.");
assert.equal(result.evaluatedMarginRange.scenarioCount, 201);
assert.equal(result.hedgeCostIfMiddleMisses, Math.max(0, -result.worstOutsideNet));
assert.ok(result.modelingNotice.includes("integer margins"));
assert.ok(Array.isArray(result.pushMargins));
assert.throws(() => summarizeAlertOutcomes([], middle, middle), /required/);
console.log("coordinated-alert-outcomes tests passed");
