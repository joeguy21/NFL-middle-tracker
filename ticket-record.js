"use strict";
const { teamCode } = require("./ticket-game-resolver");

// Validates immutable accepted wager facts for registration only. This is NOT
// authentication, event verification, or alert enrollment.
function validateTicketRecord(ticket) {
  if (!ticket || typeof ticket !== "object" || Array.isArray(ticket))
    return {ok:false,reason:"invalid-ticket"};
  if (ticket.recordType !== "ticket") return {ok:false,reason:"not-a-ticket"};
  if (typeof ticket.id !== "string" || !ticket.id.trim() || ticket.id.length > 160)
    return {ok:false,reason:"invalid-ticket-id"};
  const market = ticket.betType ?? ticket.marketType;
  if (!["moneyline","spread"].includes(market))
    return {ok:false,reason:"unsupported-market"};
  if (ticket.betType != null && ticket.marketType != null && ticket.betType !== ticket.marketType)
    return {ok:false,reason:"conflicting-market"};
  const team=teamCode(ticket.team),opp=teamCode(ticket.opp);
  if (!team || !opp || team===opp) return {ok:false,reason:"invalid-team-pair"};
  if (ticket.gameId == null || !String(ticket.gameId).trim() || String(ticket.gameId).length>160)
    return {ok:false,reason:"event-id-required"};
  const odds=Number(ticket.a ?? ticket.odds),stake=Number(ticket.s ?? ticket.stake);
  if (!Number.isInteger(odds)||odds===0||Math.abs(odds)<100||Math.abs(odds)>100000)
    return {ok:false,reason:"invalid-american-odds"};
  if (!Number.isFinite(stake)||stake<=0||stake>10000000)
    return {ok:false,reason:"invalid-stake"};
  let spread=null;
  if(market==="spread"){
    spread=Number(ticket.spread ?? ticket.handicap);
    if(!Number.isFinite(spread)||Math.abs(spread)>100)
      return {ok:false,reason:"invalid-spread"};
  }
  return {ok:true,value:Object.freeze({
    id:ticket.id,recordType:"ticket",marketType:market,gameId:String(ticket.gameId),
    team,opp,spread,odds,stake,book:typeof ticket.book==="string"?ticket.book.slice(0,100):""
  })};
}
function alertEligible(record, explicitOptIn) {
  return Boolean(record && record.marketType==="spread" && explicitOptIn===true);
}
module.exports={validateTicketRecord,alertEligible};
