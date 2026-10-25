"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createTicketRegistrationService}=require("../ticket-registration-service");
const {hashDeviceCredential}=require("../device-credentials");
const raw="a".repeat(48),hash=hashDeviceCredential(raw);
const ticket={recordType:"ticket",id:"ml-ss-test",betType:"moneyline",gameId:"evt-ss",team:"New Orleans Saints",opp:"Pittsburgh Steelers",a:134,s:100,book:"Test"};
const games=[{id:"evt-ss",away:{name:"Pittsburgh Steelers",abbreviation:"PIT"},home:{name:"New Orleans Saints",abbreviation:"NO"}}];
function setup({active=true,events=games,register=async()=>({ok:true,action:"inserted"})}={}){
 const authRepository={async findActiveDeviceByCredentialHash(h){assert.equal(h,hash);return active?{deviceId:"device-a",principalId:"principal-a"}:null}};
 return createTicketRegistrationService({authRepository,ticketRepository:{register},resolveGames:async()=>events});
}
test("rejects missing auth before ticket registration",async()=>assert.equal((await setup().register(null,ticket)).status,401));
test("registers verified authenticated moneyline ticket",async()=>{let owner;const svc=setup({register:async(p,r)=>{owner=p;assert.equal(r.marketType,"moneyline");return{ok:true,action:"inserted"}}});const r=await svc.register("Bearer "+raw,ticket);assert.equal(r.status,201);assert.equal(owner,"principal-a");assert.equal(r.body.eventId,"evt-ss")});
test("rejects event team mismatch",async()=>assert.equal((await setup({events:[{...games[0],home:{name:"Cincinnati Bengals",abbreviation:"CIN"}}]}).register("Bearer "+raw,ticket)).status,422));
test("rejects duplicate event identity",async()=>{const duplicate=[...games,{...games[0]}];assert.equal((await setup({events:duplicate}).register("Bearer "+raw,ticket)).status,422)});
test("returns unavailable when event feed fails",async()=>{const svc=createTicketRegistrationService({authRepository:{findActiveDeviceByCredentialHash:async()=>({deviceId:"d",principalId:"p"})},ticketRepository:{register:async()=>{throw Error("must not")}},resolveGames:async()=>{throw Error("offline")}});assert.equal((await svc.register("Bearer "+raw,ticket)).status,503)});
test("returns conflict for changed accepted terms",async()=>assert.equal((await setup({register:async()=>({ok:false,action:"conflict"})}).register("Bearer "+raw,ticket)).status,409));
