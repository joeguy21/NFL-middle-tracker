"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeScoreboard, quarterMilestone, quarterTransition } = require("../game-state");

const sample = {
  events: [{
    id: "401999001", name: "Away at Home", date: "2026-10-25T17:00Z",
    competitions: [{
      competitors: [
        { homeAway: "away", team: { displayName: "Pittsburgh Steelers", abbreviation: "PIT" }, score: "14" },
        { homeAway: "home", team: { displayName: "Cincinnati Bengals", abbreviation: "CIN" }, score: "10" }
      ],
      status: { period: 2, displayClock: "0:00", type: { state: "in", name: "STATUS_IN_PROGRESS", completed: false } }
    }]
  }]
};

test("normalizes score, teams, period, and clock without losing source state", () => {
  const [g] = normalizeScoreboard(sample);
  assert.equal(g.id, "401999001");
  assert.equal(g.away.name, "Pittsburgh Steelers");
  assert.equal(g.home.name, "Cincinnati Bengals");
  assert.equal(g.away.score, 14);
  assert.equal(g.home.score, 10);
  assert.equal(g.period, 2);
  assert.equal(g.clock, "0:00");
  assert.equal(g.scoreValid, true);
});

test("detects only live end-of-Q1/Q2/Q3 milestones", () => {
  const [g] = normalizeScoreboard(sample);
  assert.equal(quarterMilestone(g), "Q2");
  assert.equal(quarterMilestone({ ...g, period: 4 }), null);
  assert.equal(quarterMilestone({ ...g, state: "pre" }), null);
  assert.equal(quarterMilestone({ ...g, completed: true }), null);
  assert.equal(quarterMilestone({ ...g, clock: "0:01" }), null);
});

test("does not claim a score is valid when a competitor score is missing", () => {
  const payload = structuredClone(sample);
  payload.events[0].competitions[0].competitors[0].score = "";
  assert.equal(normalizeScoreboard(payload)[0].scoreValid, false);
});

test("ignores malformed or nameless events", () => {
  assert.deepEqual(normalizeScoreboard({ events: [{ id: "no teams" }, null] }), []);
  assert.deepEqual(normalizeScoreboard(null), []);
});


test("detects a quarter transition even when polling misses exact 0:00", () => {
 const [live] = normalizeScoreboard(sample);
 assert.equal(quarterTransition({ ...live, period: 1, clock: "0:12" }, { ...live, period: 2, clock: "15:00" }), "Q1");
 assert.equal(quarterTransition({ ...live, period: 2 }, { ...live, period: 3 }), "Q2");
 assert.equal(quarterTransition({ ...live, period: 3 }, { ...live, period: 4 }), "Q3");
});

test("does not infer quarter completion across gaps or game identities", () => {
 const [live] = normalizeScoreboard(sample);
 assert.equal(quarterTransition({ ...live, period: 1 }, { ...live, period: 3 }), null);
 assert.equal(quarterTransition({ ...live, id: "other", period: 1 }, { ...live, period: 2 }), null);
 assert.equal(quarterTransition({ ...live, period: 3 }, { ...live, period: 4, completed: true }), null);
 assert.equal(quarterTransition({ ...live, period: 1, state: "pre" }, { ...live, period: 2 }), null);
});
