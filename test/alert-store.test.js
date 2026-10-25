"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { reserveAlert, markAlert } = require("../alert-store");

test("alert reservation uses database uniqueness to admit only first claim", async () => {
 const calls=[];
 const pool={query:async(sql,args)=>{calls.push({sql,args});return {rowCount:calls.length===1?1:0}}};
 const input={userId:"u",alertId:"a",kind:"hedge",ticketId:"t",gameId:"g",payload:{milestone:"Q1"}};
 assert.equal(await reserveAlert(pool,input),true);
 assert.equal(await reserveAlert(pool,input),false);
 assert.match(calls[0].sql,/ON CONFLICT\(user_id,alert_id\) DO NOTHING/);
 assert.equal(calls[0].args[0],"u");
});

test("delivery status only transitions from pending", async()=>{
 const calls=[];
 const pool={query:async(sql,args)=>{calls.push({sql,args});return {rowCount:1}}};
 assert.equal(await markAlert(pool,{userId:"u",alertId:"a",status:"sent"}),true);
 assert.match(calls[0].sql,/status='pending'/);
 await assert.rejects(()=>markAlert(pool,{userId:"u",alertId:"a",status:"pending"}),/Invalid alert delivery status/);
});
