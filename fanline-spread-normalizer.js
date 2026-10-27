/**
 * Normalize FanLine full-game spread market records into planner quote objects.
 * Requires the caller to explicitly supply sportsbook attribution; never infer a
 * multi-book quote from a single feed response. Match exact team names.
 */
function normalizeFanLineSpreads(payload, { teamA, teamB, sportsbook, nowMs, maxAgeMs = 30000 } = {}) {
  if (!payload || !Array.isArray(payload.markets)) throw new Error("FanLine payload must contain a markets array.");
  if (!teamA || !teamB || teamA === teamB) throw new Error("Distinct Team A and Team B names are required.");
  if (!sportsbook || !String(sportsbook).trim()) throw new Error("Explicit sportsbook attribution is required.");
  const wanted = new Map([[String(teamA).trim().toLowerCase(), "A"], [String(teamB).trim().toLowerCase(), "B"]]);
  const quotes = [];
  for (const market of payload.markets) {
    if (String(market.league).toLowerCase() !== "nfl" ||
        String(market.category).toLowerCase() !== "spread" ||
        String(market.period).toLowerCase() !== "game" ||
        String(market.status).toUpperCase() !== "OPEN" ||
        String(market.market_type).toUpperCase() !== "MATCH_HANDICAP_(2-WAY)") continue;
    const eventTeams = [market.away_team, market.home_team].map(x => String(x || "").trim().toLowerCase());
    if (!eventTeams.includes(String(teamA).trim().toLowerCase()) ||
        !eventTeams.includes(String(teamB).trim().toLowerCase())) continue;
    const updated = Date.parse(market.updated_at);
    if (!Number.isFinite(updated)) continue;
    if (nowMs != null && (updated > nowMs || nowMs - updated > maxAgeMs)) continue;
    if (!Array.isArray(market.selections) || market.selections.length !== 2) continue;
    const seen = new Set();
    for (const selection of market.selections) {
      const team = wanted.get(String(selection.name || "").trim().toLowerCase());
      const spread = selection.handicap;
      const odds = selection.american;
      if (!team || seen.has(team) || String(selection.status).toUpperCase() !== "ACTIVE" ||
          !Number.isFinite(spread) || !Number.isFinite(odds) || odds === 0) { seen.clear(); break; }
      seen.add(team);
      quotes.push({
        team, spread, odds, sportsbook: String(sportsbook).trim(),
        timestampMs: updated, quoteId: String(selection.selection_id || ""),
        marketId: String(market.market_id || ""),
        eventId: String(market.event_id || ""),
        event: market.event, period: market.period, category: market.category,
        marketType: market.market_type
      });
    }
    if (seen.size !== 2) {
      // Drop any partial entries from this market if selection validation failed.
      const id = String(market.market_id || "");
      for (let i = quotes.length - 1; i >= 0; i--) if (quotes[i].marketId === id) quotes.splice(i, 1);
    }
  }
  return quotes;
}
module.exports = { normalizeFanLineSpreads };
