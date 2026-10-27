/**
 * Conservative cross-feed event matcher.
 * Input event: {homeTeam, awayTeam, startTime, league?}
 * Only exact normalized team labels and close kickoff times are eligible.
 * Ambiguous candidate sets intentionally return no match.
 */
function normTeam(v) {
  return String(v || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function eventSignature(event) {
  const home = normTeam(event && event.homeTeam);
  const away = normTeam(event && event.awayTeam);
  const start = Date.parse(event && event.startTime);
  const league = String(event && event.league || "").trim().toLowerCase();
  if (!home || !away || home === away || !Number.isFinite(start) || !league) return null;
  return { teams: [home, away].sort(), start, league };
}
function matchCrossFeedEvent(target, candidates, { toleranceMs = 15 * 60 * 1000 } = {}) {
  if (!Array.isArray(candidates) || !(toleranceMs >= 0)) return null;
  const wanted = eventSignature(target);
  if (!wanted) return null;
  const matched = candidates.filter(candidate => {
    const sig = eventSignature(candidate);
    return sig && sig.league === wanted.league &&
      sig.teams[0] === wanted.teams[0] && sig.teams[1] === wanted.teams[1] &&
      Math.abs(sig.start - wanted.start) <= toleranceMs;
  });
  return matched.length === 1 ? matched[0] : null;
}
module.exports = { normTeam, eventSignature, matchCrossFeedEvent };
