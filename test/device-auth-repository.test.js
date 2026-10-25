"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {createDeviceAuthRepository}=require("../device-auth-repository");
const hash="a".repeat(64);

test("repository uses a parameterized hash lookup and returns trusted owner",async()=>{
 let call;
 const repository=createDeviceAuthRepository({async query(...args){call=args;return {rows:[{deviceId:"dev-x",principalId:"owner-y"}]};}});
 assert.deepEqual(await repository.findActiveDeviceByCredentialHash(hash),{deviceId:"dev-x",principalId:"owner-y"});
 assert.deepEqual(call[1],[hash]);
 assert.match(call[0],/JOIN alert_principals/);
 assert.match(call[0],/d\.revoked_at IS NULL/);
 assert.match(call[0],/p\.disabled_at IS NULL/);
 assert.match(call[0],/d\.credential_hash = \$1/);
});
test("invalid hash fails closed without database access",async()=>{
 let calls=0;const r=createDeviceAuthRepository({async query(){calls++;return {rows:[]};}});
 assert.equal(await r.findActiveDeviceByCredentialHash("bad"),null);
 assert.equal(calls,0);
});
test("missing, revoked, disabled, or malformed result is denied",async()=>{
 const r=createDeviceAuthRepository({async query(){return {rows:[]};}});
 assert.equal(await r.findActiveDeviceByCredentialHash(hash),null);
 const malformed=createDeviceAuthRepository({async query(){return {rows:[{deviceId:"only-device"}]};}});
 assert.equal(await malformed.findActiveDeviceByCredentialHash(hash),null);
});
test("requires a query-capable database adapter",()=>assert.throws(()=>createDeviceAuthRepository(null),TypeError));
