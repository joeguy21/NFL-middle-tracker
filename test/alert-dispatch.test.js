"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {dispatchAlert}=require("../alert-dispatch");
function harness({muted=false,alreadyReserved=false,subscriptions=[{endpoint:"e1",subscription:{endpoint:"e1"}}]}={}){
 const calls=[];const pool={async query(sql,params){calls.push({sql,params});
  if(sql.includes("SELECT 1 FROM tracker_muted_games"))return {rowCount:muted?1:0,rows:muted?[{}]:[]};
  if(sql.includes("INSERT INTO tracker_alert_deliveries"))return {rowCount:alreadyReserved?0:1,rows:[]};
  if(sql.includes("SELECT endpoint,subscription"))return {rowCount:subscriptions.length,rows:subscriptions};
  if(sql.includes("UPDATE tracker_alert_deliveries"))return {rowCount:1,rows:[]};
  if(sql.includes("DELETE FROM tracker_push_subscriptions"))return {rowCount:1,rows:[]};
  throw Error("Unexpected query: "+sql);
 }};return {pool,calls};
}
const args={userId:"d8b2d4cb-10cb-4e2c-9d11-a8bd34a5c102",alertId:"ticket-12-middle-event-abc",kind:"middle",ticketId:"ticket-12",gameId:"espn-123",payload:{title:"Middle alert",body:"Window over threshold"}};
test("muted event exits before reserving or pushing",async()=>{const h=harness({muted:true});let sends=0;const result=await dispatchAlert({...h,...args,webpush:{sendNotification:async()=>sends++}});assert.deepEqual(result,{status:"muted",sent:0});assert.equal(sends,0);assert.equal(h.calls.length,1)});
test("existing delivery identity is suppressed",async()=>{const h=harness({alreadyReserved:true});let sends=0;const result=await dispatchAlert({...h,...args,webpush:{sendNotification:async()=>sends++}});assert.equal(result.status,"duplicate");assert.equal(sends,0)});
test("new eligible alert sends and marks the delivery sent",async()=>{const h=harness();let sends=0;const result=await dispatchAlert({...h,...args,webpush:{sendNotification:async()=>{sends++}}});assert.equal(result.status,"sent");assert.equal(result.sent,1);assert.equal(sends,1);assert.ok(h.calls.some(c=>c.sql.includes("UPDATE tracker_alert_deliveries")))});
test("validates alert kind",async()=>{const h=harness();await assert.rejects(()=>dispatchAlert({...h,...args,kind:"other",webpush:{sendNotification:async()=>{}}}),/Invalid alert kind/)});
