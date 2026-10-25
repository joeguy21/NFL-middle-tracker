"use strict";
const crypto=require("node:crypto");

// Canonical snapshot of the immutable accepted wager fields. Do not include
// tracking preferences or mutable display metadata in this fingerprint.
const IMMUTABLE_FIELDS=["id","gameId","team","opp","spread","odds","stake","book"];
function ticketFingerprint(ticket){
  if(!ticket||typeof ticket!=="object")throw new TypeError("Ticket object required");
  const snapshot={};
  for(const key of IMMUTABLE_FIELDS)snapshot[key]=ticket[key]??(key==="book"?"":null);
  return crypto.createHash("sha256").update(JSON.stringify(snapshot),"utf8").digest("hex");
}

// Registration behavior for persistence layers. Ownership is always part of
// the database key. Existing identical ticket is a safe retry; changed accepted
// wager data requires a separately audited amendment flow.
function classifyRegistration(existing,incoming){
  if(!incoming||typeof incoming.id!=="string"||!incoming.id.trim())
    return {action:"reject",reason:"invalid-ticket-id"};
  if(!existing)return {action:"insert"};
  if(ticketFingerprint(existing)===ticketFingerprint(incoming))
    return {action:"no-op",reason:"already-registered"};
  return {action:"conflict",reason:"accepted-ticket-changed"};
}
module.exports={ticketFingerprint,classifyRegistration};
