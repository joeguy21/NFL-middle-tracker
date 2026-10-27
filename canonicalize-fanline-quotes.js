const { normalizeFanLineSpreads } = require("./fanline-spread-normalizer");
const { eventSignature, matchCrossFeedEvent } = require("./cross-feed-event-matcher");

/**
 * Bind FanLine spreads to a selected canonical scheduled game.
 * Requires explicit scheduled kickoff and source attribution.
 * Outputs a stable event key; never pairs on provider event/market IDs.
 */
function canonicalizeFanLineQuotes(payload, {
  selectedEvent, sportsbook, teamA, teamB, nowMs, maxAgeMs = 30000,
  kickoffToleranceMs = 15 * 60 * 1000
} = {}) {
  const signature = eventSignature(selectedEvent);
  if (!signature) throw new Error("Selected game requires league, homeTeam, awayTeam, and valid startTime.");
  const quotes = normalizeFanLineSpreads(payload, {teamA, teamB, sportsbook, nowMs, maxAgeMs});
  const matchingMarkets = new Map();
  for (const market of payload.markets) {
    const event = {
      league: market.league,
      homeTeam: market.home_team,
      awayTeam: market.away_team,
      startTime: market.start_time
    };
    if (matchCrossFeedEvent(selectedEvent, [event], {toleranceMs:kickoffToleranceMs})) {
      matchingMarkets.set(String(market.market_id || ""), event);
    }
  }
  const valid = quotes.filter(q => matchingMarkets.has(q.marketId));
  const key = `${signature.league}:${signature.teams.join("|")}:${signature.start}`;
  return valid.map(q => ({
    ...q,
    eventId: key,
    scheduledEvent: {
      league: signature.league,
      teams: signature.teams,
      startTime: new Date(signature.start).toISOString()
    },
    sourceEventId: q.eventId,
    sourceMarketId: q.marketId
  }));
}
module.exports = { canonicalizeFanLineQuotes };
