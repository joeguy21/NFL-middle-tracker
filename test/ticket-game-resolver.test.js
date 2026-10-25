"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {resolveTicketGame,teamCode}=require("../ticket-game-resolver");
const games=[
 {id:"evt-1",away:{name:"Pittsburgh Steelers",abbreviation:"PIT"},home:{name:"Cincinnati Bengals",abbreviation:"CIN"}},
 {id:"evt-2",away:{name:"Baltimore Ravens",abbreviation:"BAL"},home:{name:"Cleveland Browns",abbreviation:"CLE"}}
];
test("explicit event ID resolves only after exact team verification",()=>{
 const r=resolveTicketGame({gameId:"evt-1",team:"PIT",opp:"CIN"},games);
 assert.equal(r.resolved,true);assert.equal(r.method,"event-id");
 assert.equal(resolveTicketGame({gameId:"evt-1",team:"PIT",opp:"BAL"},games).reason,"event-team-mismatch");
});
test("legacy tickets resolve unique matchup regardless of home/away order",()=>{
 const r=resolveTicketGame({team:"Cincinnati Bengals",opp:"Pittsburgh Steelers"},games);
 assert.equal(r.resolved,true);assert.equal(r.game.id,"evt-1");assert.equal(r.method,"unique-matchup");
});
test("missing and unknown matchups fail closed",()=>{
 assert.equal(resolveTicketGame({team:"Steelers",opp:"Bengals"},games).reason,"matchup-not-found");
 assert.equal(resolveTicketGame({team:"PIT"},games).reason,"missing-team-pair");
});
test("duplicate scheduled matchup is refused",()=>{
 const duplicate={...games[0],id:"evt-3"};
 assert.equal(resolveTicketGame({team:"PIT",opp:"CIN"},[...games,duplicate]).reason,"ambiguous-matchup");
});
test("unknown team names are not guessed",()=>{
 assert.equal(teamCode("Steelers"),null);
 assert.equal(teamCode("Pittsburgh Steelers"),"pit");
});
