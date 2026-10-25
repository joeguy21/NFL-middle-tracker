"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { alertKey, shouldNotify } = require("../alert-identity");

const base = { userId: "user-1", ticketId: "ticket-4", gameId: "game-9" };

test("quarter hedge alert keys are stable per ticket, game, and quarter", () => {
  const first = alertKey({ ...base, kind: "hedge", milestone: "Q1" });
  assert.equal(first, alertKey({ ...base, kind: "hedge", milestone: "Q1" }));
  assert.notEqual(first, alertKey({ ...base, kind: "hedge", milestone: "Q2" }));
});

test("middle alert identity distinguishes market opportunity signatures", () => {
  assert.notEqual(
    alertKey({ ...base, kind: "middle", opportunitySignature: "line-a" }),
    alertKey({ ...base, kind: "middle", opportunitySignature: "line-b" })
  );
});

test("middle sends only above three points and quarter hedge only at Q1-Q3", () => {
  assert.equal(shouldNotify({ kind: "middle", width: 3.01 }), true);
  assert.equal(shouldNotify({ kind: "middle", width: 3 }), false);
  assert.equal(shouldNotify({ kind: "hedge", milestone: "Q3" }), true);
  assert.equal(shouldNotify({ kind: "hedge", milestone: "Q4" }), false);
});

test("previously sent alert suppresses duplicate delivery", () => {
  assert.equal(shouldNotify({ kind: "middle", width: 6, priorKeyExists: true }), false);
  assert.equal(shouldNotify({ kind: "hedge", milestone: "Q2", priorKeyExists: true }), false);
});

test("rejects incomplete or unsupported alert identities", () => {
  assert.throws(() => alertKey({ ...base, kind: "hedge", milestone: "Q4" }));
  assert.throws(() => alertKey({ ...base, kind: "middle" }));
  assert.throws(() => alertKey({ ...base, kind: "push" }));
});
