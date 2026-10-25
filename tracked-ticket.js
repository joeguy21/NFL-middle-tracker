"use strict";

// Contract for server registration. This validates structure only; event resolution
// and authenticated ownership must still be enforced by the eventual API.
const { teamCode } = require("./ticket-game-resolver");

function validateTrackedTicket(ticket) {
  if (!ticket || typeof ticket !== "object" || Array.isArray(ticket))
    return { ok:false, reason:"invalid-ticket" };
  if (ticket.recordType !== "ticket") return { ok:false, reason:"not-a-ticket" };
  if (typeof ticket.id !== "string" || !ticket.id.trim() || ticket.id.length > 160)
    return { ok:false, reason:"invalid-ticket-id" };
  if (ticket.betType !== "spread" && ticket.marketType !== "spread")
    return { ok:false, reason:"spread-ticket-required" };
  const team = teamCode(ticket.team), opp = teamCode(ticket.opp);
  if (!team || !opp || team === opp) return { ok:false, reason:"invalid-team-pair" };
  if (ticket.gameId == null || !String(ticket.gameId).trim() || String(ticket.gameId).length > 160)
    return { ok:false, reason:"event-id-required" };
  const spread = Number(ticket.spread ?? ticket.handicap);
  if (!Number.isFinite(spread) || Math.abs(spread) > 100)
    return { ok:false, reason:"invalid-spread" };
  const odds = Number(ticket.a ?? ticket.odds);
  if (!Number.isInteger(odds) || odds === 0 || Math.abs(odds) < 100 || Math.abs(odds) > 100000)
    return { ok:false, reason:"invalid-american-odds" };
  const stake = Number(ticket.s ?? ticket.stake);
  if (!Number.isFinite(stake) || stake <= 0 || stake > 10000000)
    return { ok:false, reason:"invalid-stake" };
  if (ticket.alertTracking !== true)
    return { ok:false, reason:"tracking-not-opted-in" };
  return { ok:true, value:{
    id:ticket.id, recordType:"ticket", marketType:"spread",
    gameId:String(ticket.gameId), team, opp, spread, odds, stake,
    book:typeof ticket.book === "string" ? ticket.book.slice(0,100) : "",
    alertTracking:true
  }};
}
module.exports = { validateTrackedTicket };
