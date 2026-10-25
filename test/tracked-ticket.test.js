"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateTrackedTicket } = require("../tracked-ticket");
const good = () => ({recordType:"ticket",id:"stable-ticket-1",betType:"spread",
  gameId:"401234567",team:"Buffalo Bills",opp:"Miami Dolphins",
  spread:-3.5,a:-110,s:25,book:"Test Book",alertTracking:true});

test("accepts explicitly opted-in, structured spread ticket",()=>{
  const result=validateTrackedTicket(good());
  assert.equal(result.ok,true);
  assert.equal(result.value.marketType,"spread");
  assert.equal(result.value.spread,-3.5);
  assert.equal(result.value.gameId,"401234567");
});
test("rejects moneyline even when ticket otherwise looks valid",()=>{
  const t=good();t.betType="moneyline";
  assert.equal(validateTrackedTicket(t).reason,"spread-ticket-required");
});
test("rejects conflicting market type declarations",()=>{
  const t=good();t.marketType="moneyline";
  assert.equal(validateTrackedTicket(t).reason,"spread-ticket-required");
});
test("rejects ticket without affirmative opt-in",()=>{
  const t=good();t.alertTracking=false;
  assert.equal(validateTrackedTicket(t).reason,"tracking-not-opted-in");
});
test("rejects unstable ID, missing event, invalid team pair, and absent handicap",()=>{
  for(const [mutate,reason] of [
    [t=>t.id=17,"invalid-ticket-id"],
    [t=>t.gameId=null,"event-id-required"],
    [t=>{t.team="Steelers";t.opp="Mystery";},"invalid-team-pair"],
    [t=>delete t.spread,"invalid-spread"]
  ]){const t=good();mutate(t);assert.equal(validateTrackedTicket(t).reason,reason)}
});
test("rejects invalid odds and nonpositive stake",()=>{
  for(const [mutate,reason] of [
    [t=>t.a=0,"invalid-american-odds"],
    [t=>t.a=-99,"invalid-american-odds"],
    [t=>t.s=0,"invalid-stake"],
    [t=>t.s=-4,"invalid-stake"]
  ]){const t=good();mutate(t);assert.equal(validateTrackedTicket(t).reason,reason)}
});
test("never treats team labels as spread semantics",()=>{
  const t=good();t.marketType="moneyline";delete t.betType;
  assert.equal(validateTrackedTicket(t).reason,"spread-ticket-required");
});
test("rejects non-object payloads",()=>{
  assert.equal(validateTrackedTicket(null).reason,"invalid-ticket");
  assert.equal(validateTrackedTicket([]).reason,"invalid-ticket");
});
