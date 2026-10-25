"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {issueDeviceCredential,hashDeviceCredential,credentialMatches}=require("../device-credentials");

test("issues a high-entropy opaque credential and matching one-way hash",()=>{
 const issued=issueDeviceCredential();
 assert.match(issued.token,/^[A-Za-z0-9_-]{40,128}$/);
 assert.match(issued.tokenHash,/^[a-f0-9]{64}$/);
 assert.notEqual(issued.token,issued.tokenHash);
 assert.equal(credentialMatches(issued.token,issued.tokenHash),true);
});
test("rejects wrong or malformed bearer values",()=>{
 const issued=issueDeviceCredential();
 assert.equal(credentialMatches(issued.token+"x",issued.tokenHash),false);
 assert.equal(credentialMatches("",issued.tokenHash),false);
 assert.equal(credentialMatches(issued.token,"nope"),false);
 assert.equal(hashDeviceCredential(""),null);
 assert.equal(hashDeviceCredential(null),null);
});
test("independent issuance yields distinct credentials",()=>{
 const one=issueDeviceCredential(),two=issueDeviceCredential();
 assert.notEqual(one.token,two.token);
 assert.notEqual(one.tokenHash,two.tokenHash);
});
