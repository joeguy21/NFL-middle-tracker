/**
 * Normalize FanLine full-game spread market records into planner quote objects.
 * Requires explicit sportsbook attribution; never infer a multi-book quote.
 * Provider feeds can label a scheduled market PRE (rather than OPEN) and may
 * vary the market_type label. Validate the actual two opposing selections.
 */
function normalizeFanLineSpreads(payload, { teamA, teamB, sportsbook, nowMs, maxAgeMs = 30000 } = {}) {
  if (!payload || !Array.isArray(payload.markets)) throw new Error("FanLine payload must contain a markets array.");
  if (!teamA || !teamB || teamA === teamB) throw new Error("Distinct Team A and Team B names are required.");
  if (!sportsbook || !String(sportsbook).trim()) throw new Error("Explicit sportsbook attribution is required.");
  const wanted = new Map([[String(teamA).trim().toLowerCase(), "A"], [String(teamB).trim().toLowerCase(), "B"]]);
  const quotes = [];
  for (const market of payload.markets) {
    if (String(market.league || "").toLowerCase() !== "nfl" ||
        String(market.category || market.market || "").toLowerCase() !== "spread" ||
        String(market.period || "").toLowerCase() !== "game") continue;
    // Market status is distinct from event status. Scheduled feeds commonly use PRE.
    const marketStatus = String(market.status || "").toUpperCase();
    if (marketStatus && !["OPEN", "ACTIVE", "PRE"].includes(marketStatus)) continue;
    const eventTeams = [market.away_team, market.home_team].map(x => String(x || "").trim().toLowerCase());
    if (!eventTeams.includes(String(teamA).trim().toLowerCase()) ||
        !eventTeams.includes(String(teamB).trim().toLowerCase())) continue;
    const updated = Date.parse(market.updated_at);
    if (!Number.isFinite(updated)) continue;
    if (nowMs != null && (updated > nowMs || nowMs - updated > maxAgeMs)) continue;
    if (!Array.isArray(market.selections) || market.selections.length !== 2) continue;
    const staged = [], seen = new Set();
    let invalid = false;
    for (const selection of market.selections) {
      const team = wanted.get(String(selection.name || "").trim().toLowerCase());
      const spread = Number(selection.handicap);
      const odds = Number(selection.american);
      const selectionStatus = String(selection.status || "").toUpperCase();
      if (!team || seen.has(team) ||
          (selectionStatus && !["ACTIVE", "OPEN", "PRE"].includes(selectionStatus)) ||
          !Number.isFinite(spread) || !Number.isFinite(odds) || odds === 0) { invalid = true; break; }
      seen.add(team);
      staged.push({
        team, spread, odds, sportsbook: String(sportsbook).trim(),
        timestampMs: updated, quoteId: String(selection.selection_id || ""),
        marketId: String(market.market_id || ""),
        eventId: String(market.event_id || ""),
        event: market.event, period: market.period, category: "spread",
        marketType: market.market_type || market.market || "spread"
      });
    }
    if (invalid || seen.size !== 2 || staged.length !== 2 ||
        Math.abs(staged[0].spread + staged[1].spread) > 0.001) continue;
    quotes.push(...staged);
  }
  return quotes;
}
module.exports = { normalizeFanLineSpreads };
