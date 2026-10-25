"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {ticketFingerprint,classifyRegistration}=require("../ticket-registration");
const ticket=()=>({id:"t-123",gameId:"evt-9",team:"buf",opp:"mia",spread:-3.5,odds:-110,stake:25,book:"Book A",alertTracking:true});
test("new registration inserts",()=>assert.equal(classifyRegistration(null,ticket()).action,"insert"));
test("identical registration retry is a no-op",()=>{
 const t=ticket();assert.deepEqual(classifyRegistration(t,t),{action:"no-op",reason:"already-registered"});
});
test("mutable preference does not change accepted ticket identity",()=>{
 const a=ticket(),b=ticket();b.alertTracking=false;
 assert.equal(ticketFingerprint(a),ticketFingerprint(b));
 assert.equal(classifyRegistration(a,b).action,"no-op");
});
test("changed immutable accepted terms require conflict workflow",()=>{
 for(const key of ["gameId","team","opp","spread","odds","stake","book"]){
  const a=ticket(),b=ticket();b[key]=key==="stake"?40:key==="spread"?-6:key==="odds"?105:key==="gameId"?"evt-10":key==="team"?"pit":key==="opp"?"ne":"Book B";
  assert.equal(classifyRegistration(a,b).action,"conflict",key);
 }
});
test("ticket IDs are required",()=>assert.equal(classifyRegistration(null,{id:" "}).reason,"invalid-ticket-id"));
test("fingerprint is stable and a SHA-256 hex digest",()=>{
 const a=ticket();assert.equal(ticketFingerprint(a),ticketFingerprint({...a}));
 assert.match(ticketFingerprint(a),/^[a-f0-9]{64}$/);
});
