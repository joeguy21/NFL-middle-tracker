"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {muteGame,unmuteGame,getMutedGames}=require("../alert-controls");
test("mute and unmute use the requested event key",async()=>{
 const calls=[];const request=async(path,options={})=>{calls.push({path,options});return {mutedGames:[]}};
 await muteGame(request,"event-42");await unmuteGame(request,"event-42");
 assert.equal(calls[0].path,"/api/my-notifications/mute-game");
 assert.deepEqual(JSON.parse(calls[0].options.body),{gameId:"event-42"});
 assert.equal(calls[1].path,"/api/my-notifications/mute-game?gameId=event-42");
});
test("reject blank game keys",async()=>{
 const request=async()=>{throw Error("unexpected request")};
 await assert.rejects(muteGame(request,"  "),/game ID/);
 await assert.rejects(unmuteGame(request,""),/game ID/);
});
test("list muted entries safely defaults to empty",async()=>{
 assert.deepEqual(await getMutedGames(async()=>({mutedGames:[{game_id:"evt"}]})),[{game_id:"evt"}]);
 assert.deepEqual(await getMutedGames(async()=>({})),[]);
});
