"use strict";
const test=require("node:test"),assert=require("node:assert/strict");const {decimalOdds,equalReturnHedge}=require("../bet-math");
test("converts positive and negative American odds",()=>{assert.equal(decimalOdds(150),2.5);assert.equal(decimalOdds(-200),1.5);assert.equal(decimalOdds(100),2);});
test("rejects zero and nonnumeric odds",()=>{assert.equal(decimalOdds(0),null);assert.equal(decimalOdds("nope"),null);});
test("balances a -166 original wager against +150 hedge",()=>{const r=equalReturnHedge({stake:100,originalOdds:-166,hedgeOdds:150});assert.equal(r.hedge,64.1);assert.equal(r.originalWins,-3.86);assert.equal(r.hedgeWins,-3.85);assert.equal(r.worstCase,-3.86);assert.equal(r.totalStake,164.1);});
test("rejects invalid stake or odds",()=>{assert.throws(()=>equalReturnHedge({stake:0,originalOdds:-110,hedgeOdds:+110}));assert.throws(()=>equalReturnHedge({stake:50,originalOdds:0,hedgeOdds:120}));});
