"use strict";
const crypto=require("node:crypto");

// Normalize legacy UI aliases into the immutable accepted-wager contract.
// The browser currently records American odds as "a" and stake as "s";
// omitting those aliases would make materially changed tickets look identical.
function canonicalTicket(ticket){
 if(!ticket||typeof ticket!=="object")throw new TypeError("Ticket object required");
 return {
  id:ticket.id??null,
  gameId:ticket.gameId==null?null:String(ticket.gameId),
  team:ticket.team??null,
  opp:ticket.opp??null,
  spread:ticket.spread??ticket.handicap??null,
  odds:ticket.odds??ticket.a??null,
  stake:ticket.stake??ticket.s??null,
  book:ticket.book??""
 };
}
function ticketFingerprint(ticket){
 return crypto.createHash("sha256").update(JSON.stringify(canonicalTicket(ticket)),"utf8").digest("hex");
}
function classifyRegistration(existing,incoming){
 if(!incoming||typeof incoming.id!=="string"||!incoming.id.trim())
  return {action:"reject",reason:"invalid-ticket-id"};
 if(!existing)return {action:"insert"};
 if(ticketFingerprint(existing)===ticketFingerprint(incoming))
  return {action:"no-op",reason:"already-registered"};
 return {action:"conflict",reason:"accepted-ticket-changed"};
}
module.exports={ticketFingerprint,classifyRegistration,canonicalTicket};
