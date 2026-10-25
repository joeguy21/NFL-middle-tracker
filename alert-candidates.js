"use strict";

// Pure candidate selection layer. Inputs must already be matched to a tracked
// ticket and normalized market snapshot by the caller. This module never fetches
// data, sends notifications, or places wagers.
const { middleWindow } = require("./middle-rules");
const { shouldNotify } = require("./alert-identity");

function isFresh(snapshot, nowMs, maxAgeMs) {
  const stamp = Date.parse(snapshot?.observedAt || "");
  return Number.isFinite(stamp) && Number.isFinite(nowMs) &&
    Number.isFinite(maxAgeMs) && maxAgeMs > 0 &&
    nowMs >= stamp && nowMs - stamp <= maxAgeMs;
}

function evaluateTrackedTicket({ ticket, market, game, nowMs = Date.now(), maxAgeMs = 90_000, gameMuted = false, priorKeys = new Set() }) {
  if (!ticket || !ticket.id || !ticket.gameId || !ticket.team || !Number.isFinite(Number(ticket.spread)) ||
      !(Number(ticket.stake) > 0) || !Number.isFinite(Number(ticket.odds)) || Number(ticket.odds) === 0) {
    return { eligible: false, reason: "invalid-ticket" };
  }
  if (String(ticket.gameId) !== String(game?.id)) return { eligible: false, reason: "game-mismatch" };
  if (!game?.scoreValid || !["in"].includes(game.state) || game.completed) return { eligible: false, reason: "game-not-live-or-score-invalid" };
  if (!market || !isFresh(market, nowMs, maxAgeMs)) return { eligible: false, reason: "market-stale-or-unknown" };
  if (gameMuted) return { eligible: false, reason: "game-muted" };
  if (!Array.isArray(market.outcomes) || market.outcomes.length < 2) return { eligible: false, reason: "incomplete-market" };

  const opposite = market.outcomes.find(x =>
    x && String(x.team || "").toLowerCase() !== String(ticket.team).toLowerCase() &&
    Number.isFinite(Number(x.spread)) && Number.isFinite(Number(x.odds)) && Number(x.odds) !== 0
  );
  if (!opposite) return { eligible: false, reason: "opposing-side-unavailable" };
  const width = middleWindow({
    firstTeam: ticket.team, firstSpread: Number(ticket.spread),
    secondTeam: opposite.team, secondSpread: Number(opposite.spread)
  }).width;
  const identityBase = { ticketId: String(ticket.id), gameId: String(game.id) };
  const candidate = {
    type: "middle",
    width,
    originalTicketId: String(ticket.id),
    gameId: String(game.id),
    opposingTeam: String(opposite.team),
    opposingSpread: Number(opposite.spread),
    opposingOdds: Number(opposite.odds),
    marketObservedAt: market.observedAt
  };
  candidate.qualifies = shouldNotify({ kind: "middle", width, priorKeyExists: priorKeys.has(JSON.stringify([identityBase.ticketId, candidate.opposingTeam, candidate.opposingSpread, candidate.opposingOdds])) });
  return { eligible: true, candidate };
}

module.exports = { evaluateTrackedTicket, isFresh };
