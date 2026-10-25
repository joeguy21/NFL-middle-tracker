"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { middleWindow, classifyAlert } = require("../middle-rules");

test("identifies a 4-point window between -3 and +7 opposing spreads", () => {
  const result = middleWindow({ firstTeam: "Steelers", firstSpread: -3, secondTeam: "Bengals", secondSpread: 7 });
  assert.equal(result.width, 4);
  assert.equal(result.hasMiddle, true);
  assert.equal(result.qualifies, true);
  assert.equal(result.lowerMargin, 3);
  assert.equal(result.upperMargin, 7);
});

test("does not qualify an exactly 3-point middle", () => {
  const result = middleWindow({ firstTeam: "A", firstSpread: -3, secondTeam: "B", secondSpread: 6 });
  assert.equal(result.width, 3);
  assert.equal(result.qualifies, false);
});

test("non-overlapping or touching ranges are not middles", () => {
  assert.equal(middleWindow({ firstTeam: "A", firstSpread: -7, secondTeam: "B", secondSpread: 3 }).width, 0);
  assert.equal(middleWindow({ firstTeam: "A", firstSpread: -3, secondTeam: "B", secondSpread: 3 }).hasMiddle, false);
});

test("rejects same-team and invalid spread pairs", () => {
  assert.throws(() => middleWindow({ firstTeam: "A", firstSpread: -3, secondTeam: "A", secondSpread: 7 }));
  assert.throws(() => middleWindow({ firstTeam: "A", firstSpread: "?", secondTeam: "B", secondSpread: 7 }));
});

test("chooses middle alerts above threshold and hedge alerts otherwise", () => {
  assert.equal(classifyAlert({ middleWidth: 3.5 }).alertType, "middle");
  assert.equal(classifyAlert({ middleWidth: 3 }).alertType, "hedge");
  assert.equal(classifyAlert({ middleWidth: 0, quarterMilestone: "Q2" }).quarterMilestone, "Q2");
  assert.equal(classifyAlert({ middleWidth: 4, quarterMilestone: "Q4" }).quarterMilestone, null);
});
