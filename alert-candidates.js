"use strict";

// Pure candidate selection layer. Inputs must already be matched to a tracked
// ticket and a single, normalized full-game spread market snapshot by caller.
// This module never fetches data, sends notifications, or places wagers.
const { middleWindow } = require("./middle-rules");

function isFresh(snapshot, nowMs, maxAgeMs) {
  const stamp = Date.parse(snapshot?.observedAt || "");
  return Number.isFinite(stamp) && Number.isFinite(nowMs) &&
    Number.isFinite(maxAgeMs) && maxAgeMs > 0 &&
    nowMs >= stamp && nowMs - stamp <= maxAgeMs;
}

function finiteNonzero(value) {
  // Reject blanks/nulls: Number("") and Number(null) are both zero.
  return value !== "" && value != null && Number.isFinite(Number(value)) && Number(value) !== 0;
}
function finite(value) {
  return value !== "" && value != null && Number.isFinite(Number(value));
}

function evaluateTrackedTicket({ ticket, market, game, nowMs = Date.now(), maxAgeMs = 90_000, gameMuted = false }) {
  if (!ticket || ticket.id == null || String(ticket.id).trim() === "" ||
      ticket.gameId == null || String(ticket.gameId).trim() === "" ||
      !ticket.team || !finite(ticket.spread) || !finite(ticket.stake) ||
      !(Number(ticket.stake) > 0) || !finiteNonzero(ticket.odds)) {
    return { eligible: false, reason: "invalid-ticket" };
  }
  if (String(ticket.gameId) !== String(game?.id)) return { eligible: false, reason: "game-mismatch" };
  if (!game?.scoreValid || game.state !== "in" || game.completed) return { eligible: false, reason: "game-not-live-or-score-invalid" };
  if (!market || market.marketType !== "spread" || market.period !== "full_game" ||
      !isFresh(market, nowMs, maxAgeMs)) return { eligible: false, reason: "market-stale-unknown-or-unsupported" };
  if (gameMuted) return { eligible: false, reason: "game-muted" };
  if (!Array.isArray(market.outcomes) || market.outcomes.length !== 2) return { eligible: false, reason: "incomplete-market" };

  const same = market.outcomes.filter(x => x && String(x.team || "").toLowerCase() === String(ticket.team).toLowerCase());
  const opposite = market.outcomes.filter(x => x && String(x.team || "").toLowerCase() !== String(ticket.team).toLowerCase());
  if (same.length !== 1 || opposite.length !== 1) return { eligible: false, reason: "market-team-mismatch" };
  const own = same[0], other = opposite[0];
  if (!finite(own.spread) || !finite(own.odds) || Number(own.odds) === 0 ||
      !finite(other.spread) || !finiteNonzero(other.odds)) {
    return { eligible: false, reason: "invalid-market-outcome" };
  }
  // Do not compare the ticket to a stale/mismatched quote on its side.
  if (Number(own.spread) !== Number(ticket.spread)) return { eligible: false, reason: "ticket-line-mismatch" };

  const width = middleWindow({
    firstTeam: ticket.team, firstSpread: Number(ticket.spread),
    secondTeam: other.team, secondSpread: Number(other.spread)
  }).width;
  return {
    eligible: true,
    candidate: {
      type: "middle",
      width,
      qualifies: width > 3,
      originalTicketId: String(ticket.id),
      gameId: String(game.id),
      opposingTeam: String(other.team),
      opposingSpread: Number(other.spread),
      opposingOdds: Number(other.odds),
      marketObservedAt: market.observedAt
    }
  };
}

module.exports = { evaluateTrackedTicket, isFresh };
