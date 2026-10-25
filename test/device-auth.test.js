"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {issueDeviceCredential}=require("../device-credentials");
const {readBearerCredential,authenticateDevice}=require("../device-auth");

test("reads one opaque Bearer token only",()=>{
 const {token}=issueDeviceCredential();
 assert.equal(readBearerCredential("Bearer "+token),token);
 assert.equal(readBearerCredential("bearer "+token),token);
 for(const bad of [null,undefined,["Bearer "+token],"Basic "+token,"Bearer "+token+" trailing","Bearer short","Bearer  "+token]) assert.equal(readBearerCredential(bad),null);
});
test("authentication queries only by credential hash and returns server-owned identity",async()=>{
 const issued=issueDeviceCredential();let queried;
 const result=await authenticateDevice("Bearer "+issued.token,{async findActiveDeviceByCredentialHash(hash){queried=hash;return {deviceId:"d-1",principalId:"p-1"};}});
 assert.equal(queried,issued.tokenHash);
 assert.deepEqual(result,{deviceId:"d-1",principalId:"p-1"});
 assert.equal(Object.isFrozen(result),true);
});
test("malformed tokens and unknown/revoked identities fail closed",async()=>{
 let calls=0;
 const repo={async findActiveDeviceByCredentialHash(){calls++;return null;}};
 assert.equal(await authenticateDevice("Bearer bad",repo),null);
 assert.equal(calls,0);
 const {token}=issueDeviceCredential();
 assert.equal(await authenticateDevice("Bearer "+token,repo),null);
 assert.equal(calls,1);
 assert.equal(await authenticateDevice("Bearer "+token,null),null);
});
test("malformed repository results fail closed",async()=>{
 const {token}=issueDeviceCredential();
 assert.equal(await authenticateDevice("Bearer "+token,{async findActiveDeviceByCredentialHash(){return {principalId:"p"};}}),null);
});
