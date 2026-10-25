"use strict";
const {authenticateDevice}=require("./device-auth");
const {validateTicketRecord}=require("./ticket-record");
const {resolveTicketGame}=require("./ticket-game-resolver");

// resolveGames must return a fresh normalized scoreboard array. A successful
// resolution proves exact event ID + opposing teams, or one unique matchup.
// This service deliberately does not enroll tickets in alerts.
function createTicketRegistrationService({authRepository,ticketRepository,resolveGames}){
 if(!authRepository||!ticketRepository||typeof ticketRepository.register!=="function"||typeof resolveGames!=="function")throw new TypeError("Auth, ticket persistence, and game resolver dependencies required");
 return Object.freeze({async register(authorization,ticket){
  const identity=await authenticateDevice(authorization,authRepository);
  if(!identity)return {status:401,body:{ok:false,error:"Authentication required"}};
  const checked=validateTicketRecord(ticket);
  if(!checked.ok)return {status:400,body:{ok:false,error:checked.reason}};
  let games;
  try{games=await resolveGames()}catch{return {status:503,body:{ok:false,error:"Game verification unavailable"}}}
  const resolved=resolveTicketGame({gameId:checked.value.gameId,team:checked.value.team,opp:checked.value.opp},games);
  if(!resolved.resolved)return {status:422,body:{ok:false,error:"Game verification failed",reason:resolved.reason}};
  const outcome=await ticketRepository.register(identity.principalId,checked.value,ticket);
  if(outcome.action==="conflict")return {status:409,body:{ok:false,error:"Accepted ticket terms conflict"}};
  return {status:outcome.action==="inserted"?201:200,body:{ok:true,action:outcome.action,ticketId:checked.value.id,eventId:resolved.game.id,marketType:checked.value.marketType}};
 }});
}
module.exports={createTicketRegistrationService};
