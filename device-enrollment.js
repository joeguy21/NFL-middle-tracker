"use strict";
const crypto = require("node:crypto");
const { issueDeviceCredential } = require("./device-credentials");

// One-time bootstrap only. Caller must enforce HTTPS and must never log headers/body.
function safeEqual(a,b){
 if(typeof a!=="string"||typeof b!=="string")return false;
 const aa=Buffer.from(a,"utf8"),bb=Buffer.from(b,"utf8");
 return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);
}
function createDeviceEnrollmentService({pool,enrollmentSecret}){
 if(!pool||typeof pool.connect!=="function")throw new TypeError("PostgreSQL pool required");
 if(typeof enrollmentSecret!=="string"||enrollmentSecret.length<32)throw new TypeError("Enrollment secret must be at least 32 characters");
 return Object.freeze({async enroll(presentedSecret,platform="ios"){
  if(!safeEqual(presentedSecret,enrollmentSecret))return {status:401,body:{ok:false,error:"Enrollment authorization failed"}};
  if(platform!=="ios"&&platform!=="web")return {status:400,body:{ok:false,error:"Unsupported platform"}};
  const c=await pool.connect();
  try{
   await c.query("BEGIN");
   // Serializes concurrent first-owner attempts across app instances.
   await c.query("SELECT pg_advisory_xact_lock(hashtext($1))",["nfl-tracker-single-owner-enrollment"]);
   const existing=await c.query("SELECT principal_id FROM alert_principals LIMIT 1");
   if(existing.rows.length){await c.query("ROLLBACK");return {status:409,body:{ok:false,error:"Owner enrollment is already complete"}}}
   const principalId="owner_"+crypto.randomUUID();
   const deviceId="device_"+crypto.randomUUID();
   const credential=issueDeviceCredential();
   await c.query("INSERT INTO alert_principals(principal_id) VALUES($1)",[principalId]);
   await c.query("INSERT INTO alert_devices(device_id,principal_id,credential_hash,platform) VALUES($1,$2,$3,$4)",[deviceId,principalId,credential.tokenHash,platform]);
   await c.query("COMMIT");
   return {status:201,body:{ok:true,deviceId,credential:credential.token}};
  }catch(e){try{await c.query("ROLLBACK")}catch{}throw e}finally{c.release()}
 }});
}
module.exports={createDeviceEnrollmentService,safeEqual};
