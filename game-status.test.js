const assert=require("node:assert/strict");
const {matchGameStatus,statusOf}=require("./game-status");
const event=(state,name,completed,detail="")=>({id:"evt1",competitions:[{competitors:[
 {homeAway:"home",team:{displayName:"Buffalo Bills",abbreviation:"BUF"}},
 {homeAway:"away",team:{displayName:"Baltimore Ravens",abbreviation:"BAL"}}
],status:{type:{state,name,completed,detail}}}]});
const game={event:{homeTeam:"Buffalo Bills",awayTeam:"Baltimore Ravens"}};
let r=matchGameStatus([event("post","STATUS_FINAL",true,"Final")],game);
assert.equal(r.status,"final");assert.equal(r.confirmedFinal,true);
r=matchGameStatus([event("in","STATUS_IN_PROGRESS",false,"Overtime")],game);
assert.equal(r.status,"in-progress");assert.equal(r.confirmedFinal,false);
r=matchGameStatus([event("pre","STATUS_POSTPONED",false,"Postponed")],game);
assert.equal(r.status,"interrupted");assert.equal(r.confirmedFinal,false);
r=matchGameStatus([event("in","STATUS_SUSPENDED",false,"Suspended")],game);
assert.equal(r.status,"interrupted");
r=matchGameStatus([],game);assert.equal(r.status,"unknown");assert.equal(r.confirmedFinal,false);
r=matchGameStatus([event("post","STATUS_FINAL",true),event("post","STATUS_FINAL",true)],game);
assert.equal(r.status,"unknown");assert.equal(r.reason,"ambiguous-match");
r=matchGameStatus([event("post","STATUS_FINAL",true)],{event:{homeTeam:"Bills",awayTeam:"Ravens"}});
assert.equal(r.status,"unknown"); // never infer from nicknames/partial text
assert.equal(statusOf({status:{type:{state:"post",name:"STATUS_POST",completed:true}}}).confirmedFinal,false);
console.log("Game-status tests passed.");
