"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {validateTicketRecord,alertEligible}=require("../ticket-record");
const ml=()=>({recordType:"ticket",id:"saved-ml-01",betType:"moneyline",gameId:"evt-1",team:"New Orleans Saints",opp:"Pittsburgh Steelers",a:134,s:100,book:"FanDuel"});
const sp=()=>({...ml(),id:"saved-sp-01",betType:"spread",spread:3.5,a:-110,s:25});
test("registers a valid moneyline record without making it alert eligible",()=>{
 const r=validateTicketRecord(ml());assert.equal(r.ok,true);assert.equal(r.value.marketType,"moneyline");
 assert.equal(r.value.spread,null);assert.equal(alertEligible(r.value,true),false);
});
test("valid opted-in spread record can be eligible",()=>{
 const r=validateTicketRecord(sp());assert.equal(r.ok,true);assert.equal(alertEligible(r.value,true),true);
 assert.equal(alertEligible(r.value,false),false);
});
test("registration eligibility requires explicit spread opt-in",()=>{
 const r=validateTicketRecord(sp());assert.equal(alertEligible(r.value,undefined),false);
});
test("rejects invalid identities, markets, pairs and terms",()=>{
 for(const [patch,reason] of [
  [{id:" "},"invalid-ticket-id"],[{betType:"prop"},"unsupported-market"],
  [{gameId:""},"event-id-required"],[{team:"Mystery"},"invalid-team-pair"],
  [{a:0},"invalid-american-odds"],[{s:0},"invalid-stake"],
  [{betType:"spread",marketType:"moneyline",spread:3},"conflicting-market"]
 ]){const r=validateTicketRecord({...ml(),...patch});assert.equal(r.reason,reason)}
});
test("spread records require a valid handicap",()=>{
 assert.equal(validateTicketRecord({...sp(),spread:null}).reason,"invalid-spread");
});
test("does not mutate caller record",()=>{
 const t=ml(),before=JSON.stringify(t);validateTicketRecord(t);assert.equal(JSON.stringify(t),before);
});
