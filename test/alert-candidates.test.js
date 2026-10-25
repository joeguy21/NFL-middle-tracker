"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {evaluateTrackedTicket,isFresh}=require("../alert-candidates");
const now=Date.parse("2026-10-25T18:00:00Z");
const ticket={id:"ticket-1",gameId:"event-1",team:"Pittsburgh Steelers",spread:-3,stake:100,odds:-110};
const game={id:"event-1",state:"in",completed:false,scoreValid:true};
const market={marketType:"spread",period:"full_game",observedAt:new Date(now-10000).toISOString(),outcomes:[
 {team:"Pittsburgh Steelers",spread:-3,odds:-110},
 {team:"Cincinnati Bengals",spread:7,odds:-105}
]};
test("fresh tracked-game opposing lines yield middle candidate >3",()=>{
 const r=evaluateTrackedTicket({ticket,market,game,nowMs:now});
 assert.equal(r.eligible,true);assert.equal(r.candidate.width,4);assert.equal(r.candidate.qualifies,true);
 assert.equal(r.candidate.type,"middle");
 assert.equal(r.candidate.original.stake,100);
 assert.equal(r.candidate.opposingOdds,-105);
 assert.ok(r.candidate.hedgeEstimate.hedge>0);
 assert.ok(Number.isFinite(r.candidate.hedgeEstimate.worstCase));
 assert.equal(r.candidate.score.away,null);
});
test("exactly three points does not qualify",()=>{
 const m={...market,outcomes:[market.outcomes[0],{...market.outcomes[1],spread:6}]};
 const r=evaluateTrackedTicket({ticket,market:m,game,nowMs:now});
 assert.equal(r.eligible,true);assert.equal(r.candidate.qualifies,false);
});
test("rejects wrong game, invalid ticket, muted game, invalid score, and stale lines",()=>{
 assert.equal(evaluateTrackedTicket({ticket,market,game:{...game,id:"other"},nowMs:now}).reason,"game-mismatch");
 assert.equal(evaluateTrackedTicket({ticket:{...ticket,stake:0},market,game,nowMs:now}).reason,"invalid-ticket");
 assert.equal(evaluateTrackedTicket({ticket,market,game,gameMuted:true,nowMs:now}).reason,"game-muted");
 assert.equal(evaluateTrackedTicket({ticket,market,game:{...game,scoreValid:false},nowMs:now}).reason,"game-not-live-or-score-invalid");
 const old={...market,observedAt:new Date(now-200000).toISOString()};
 assert.equal(evaluateTrackedTicket({ticket,market:old,game,nowMs:now}).reason,"market-stale-unknown-or-unsupported");
});
test("freshness rejects future or malformed timestamps",()=>{
 assert.equal(isFresh({observedAt:"bad"},now,90000),false);
 assert.equal(isFresh({observedAt:new Date(now+1000).toISOString()},now,90000),false);
});
test("rejects unsupported markets, mismatched own lines, malformed odds and ambiguous teams",()=>{
 assert.equal(evaluateTrackedTicket({ticket,market:{...market,marketType:"total"},game,nowMs:now}).eligible,false);
 assert.equal(evaluateTrackedTicket({ticket,market:{...market,outcomes:[{...market.outcomes[0],spread:-2},market.outcomes[1]]},game,nowMs:now}).reason,"ticket-line-mismatch");
 assert.equal(evaluateTrackedTicket({ticket,market:{...market,outcomes:[market.outcomes[0],{...market.outcomes[1],odds:""}]},game,nowMs:now}).reason,"invalid-market-outcome");
 assert.equal(evaluateTrackedTicket({ticket,market:{...market,outcomes:[market.outcomes[0],market.outcomes[0]]},game,nowMs:now}).reason,"market-team-mismatch");
});
test("never evaluates when opposite side is absent",()=>{
 assert.equal(evaluateTrackedTicket({ticket,market:{...market,outcomes:[market.outcomes[0]]},game,nowMs:now}).reason,"incomplete-market");
});
test("rejects blank ticket numerics rather than coercing blanks to zero",()=>{
 assert.equal(evaluateTrackedTicket({ticket:{...ticket,spread:""},market,game,nowMs:now}).reason,"invalid-ticket");
 assert.equal(evaluateTrackedTicket({ticket:{...ticket,odds:""},market,game,nowMs:now}).reason,"invalid-ticket");
});
