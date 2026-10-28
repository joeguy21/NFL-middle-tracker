const assert=require("node:assert/strict");
const {createCoordinatedGame,startTracking,stopTracking}=require("./coordinated-game-lifecycle");
const event={league:"nfl",homeTeam:"Green Bay Packers",awayTeam:"Carolina Panthers",startTime:"2026-10-30T00:16:00Z"};
const legs=[
 {team:"A",teamName:"Carolina Panthers",spread:3.5,odds:-110,stake:100,sportsbook:"FanDuel"},
 {team:"B",teamName:"Green Bay Packers",spread:-3.5,odds:-110,stake:100,sportsbook:"DraftKings"}
];
const saved=createCoordinatedGame({id:"g-1",event,legs,createdAt:"2026-10-29T12:00:00Z"});
assert.equal(saved.status,"tracking","Successful save activates monitoring immediately.");
assert.equal(saved.trackingStartedAt,saved.createdAt);
assert.equal(saved.originalLegs.length,2);
const active=startTracking(saved,{now:"2026-10-29T12:01:00Z"});
assert.equal(active.status,"tracking");
assert.equal(active.trackingStartedAt,saved.createdAt,"Already active save is idempotent.");
assert.equal(saved.status,"tracking","Creation immediately activates tracking.");
assert.equal(startTracking(active).status,"tracking","Repeated activation is idempotent.");
const stopped=stopTracking(active,{now:"2026-10-29T12:03:00Z"});
assert.equal(stopped.status,"stopped");
assert.throws(()=>stopTracking(stopped),/Only active tracking/);
assert.throws(()=>createCoordinatedGame({id:"x",event,legs:[legs[0]]}),/valid original wagers/);
assert.throws(()=>createCoordinatedGame({id:"x",event,legs:[legs[0],{...legs[1],team:"A"}]}),/valid original wagers/);
assert.throws(()=>createCoordinatedGame({id:"x",event,legs:[legs[0],{...legs[1],odds:0}]}),/valid original wagers/);
assert.throws(()=>startTracking({...saved,status:"stopped"}),/Only saved games/);
assert.equal(stopTracking(saved,{now:"2026-10-29T12:03:00Z"}).status,"stopped");
assert.throws(()=>createCoordinatedGame({id:"x",event,legs:[legs[0],{...legs[1],teamName:"Chicago Bears"}]}),/match a different team/);
assert.throws(()=>createCoordinatedGame({id:"x",event:{...event,homeTeam:"Carolina Panthers"},legs}),/valid ID and scheduled/);
assert.throws(()=>createCoordinatedGame({id:"x",event:{...event,league:"mlb"},legs}),/valid ID and scheduled/);
assert.throws(()=>createCoordinatedGame({id:"x",event:{...event,startTime:"not-a-date"},legs}),/valid ID and scheduled/);
assert.equal(createCoordinatedGame({id:" x ",event,legs}).id,"x");
console.log("coordinated game lifecycle tests passed");
