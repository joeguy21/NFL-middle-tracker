"use strict";
const test=require("node:test"),assert=require("node:assert/strict");const {decimalOdds,equalReturnHedge}=require("../bet-math");
test("converts positive and negative American odds",()=>{assert.equal(decimalOdds(150),2.5);assert.equal(decimalOdds(-200),1.5);assert.equal(decimalOdds(100),2);});
test("rejects zero and nonnumeric odds",()=>{assert.equal(decimalOdds(0),null);assert.equal(decimalOdds("nope"),null);});
test("balances a -166 original wager against +150 hedge",()=>{const r=equalReturnHedge({stake:100,originalOdds:-166,hedgeOdds:150});assert.equal(r.hedge,64.1);assert.equal(r.originalWins,-3.86);assert.equal(r.hedgeWins,-3.85);assert.equal(r.worstCase,-3.86);assert.equal(r.totalStake,164.1);});
test("rejects invalid stake or odds",()=>{assert.throws(()=>equalReturnHedge({stake:0,originalOdds:-110,hedgeOdds:+110}));assert.throws(()=>equalReturnHedge({stake:50,originalOdds:0,hedgeOdds:120}));});

test("hedge stake scales proportionally with stake size",()=>{const small=equalReturnHedge({stake:50,originalOdds:-166,hedgeOdds:150});const large=equalReturnHedge({stake:100,originalOdds:-166,hedgeOdds:150});assert.equal(large.hedge,Math.round(small.hedge*2*100)/100);});
test("negative-price opposing hedge returns balanced outcomes within a cent",()=>{const r=equalReturnHedge({stake:125,originalOdds:110,hedgeOdds:-105});assert.ok(Math.abs(r.originalWins-r.hedgeWins)<=0.01);assert.equal(r.totalStake,Math.round((125+r.hedge)*100)/100);});
test("rejects negative and infinite stakes",()=>{assert.throws(()=>equalReturnHedge({stake:-10,originalOdds:110,hedgeOdds:-110}));assert.throws(()=>equalReturnHedge({stake:Infinity,originalOdds:110,hedgeOdds:-110}));});
