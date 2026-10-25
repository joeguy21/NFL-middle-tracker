"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createDeviceEnrollmentService,safeEqual}=require("../device-enrollment");
function fakePool(initial=[]){
 const state={principals:[...initial],devices:[]};let releases=0;
 const client={async query(sql,args=[]){
  if(sql==="BEGIN"||sql==="COMMIT"||sql==="ROLLBACK"||sql.startsWith("SELECT pg_advisory"))return {rows:[]};
  if(sql.startsWith("SELECT principal_id FROM alert_principals"))return {rows:state.principals.map(principal_id=>({principal_id}))};
  if(sql.startsWith("INSERT INTO alert_principals")){state.principals.push(args[0]);return {rows:[]}}
  if(sql.startsWith("INSERT INTO alert_devices")){state.devices.push({id:args[0],principal:args[1],hash:args[2],platform:args[3]});return {rows:[]}}
  throw Error("Unexpected SQL: "+sql);
 },release(){releases++}};
 return {pool:{async connect(){return client}},state,get releases(){return releases}};
}
test("wrong enrollment secret is rejected before DB access",async()=>{
 const f=fakePool();const s=createDeviceEnrollmentService({pool:f.pool,enrollmentSecret:"x".repeat(40)});
 assert.equal((await s.enroll("nope")).status,401);assert.equal(f.state.principals.length,0);
});
test("first owner receives one raw token while DB stores only its hash",async()=>{
 const f=fakePool(),s=createDeviceEnrollmentService({pool:f.pool,enrollmentSecret:"x".repeat(40)});
 const r=await s.enroll("x".repeat(40));
 assert.equal(r.status,201);assert.match(r.body.credential,/^[A-Za-z0-9_-]{40,128}$/);
 assert.equal(f.state.principals.length,1);assert.equal(f.state.devices.length,1);
 assert.equal(f.state.devices[0].hash,r.body.credential.length?require("../device-credentials").hashDeviceCredential(r.body.credential):null);
 assert.equal(JSON.stringify(f.state).includes(r.body.credential),false);assert.equal(f.releases,1);
});
test("existing owner blocks additional enrollment",async()=>{
 const f=fakePool(["already-owned"]),s=createDeviceEnrollmentService({pool:f.pool,enrollmentSecret:"x".repeat(40)});
 const r=await s.enroll("x".repeat(40));assert.equal(r.status,409);assert.equal(f.state.devices.length,0);
});
test("reject weak secret and invalid platform; compare secrets safely",async()=>{
 const f=fakePool();assert.throws(()=>createDeviceEnrollmentService({pool:f.pool,enrollmentSecret:"weak"}));
 const s=createDeviceEnrollmentService({pool:f.pool,enrollmentSecret:"x".repeat(40)});
 assert.equal((await s.enroll("x".repeat(40),"android")).status,400);
 assert.equal(safeEqual("abc","abc"),true);assert.equal(safeEqual("abc","abcd"),false);
});
