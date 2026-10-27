/**
 * Conservative cross-feed event matcher.
 * Exact normalized labels plus reviewed NFL aliases; no fuzzy matching.
 * Input: {homeTeam, awayTeam, startTime, league}
 * Provider event IDs may differ. Ambiguous candidate sets fail closed.
 */
const TEAM_ALIASES = {
  "arizona": "arizona cardinals", "arizona cardinals": "arizona cardinals", "ari": "arizona cardinals",
  "atlanta": "atlanta falcons", "atlanta falcons": "atlanta falcons", "atl": "atlanta falcons",
  "baltimore": "baltimore ravens", "baltimore ravens": "baltimore ravens", "bal": "baltimore ravens",
  "buffalo": "buffalo bills", "buffalo bills": "buffalo bills", "buf": "buffalo bills",
  "carolina": "carolina panthers", "carolina panthers": "carolina panthers", "panthers": "carolina panthers", "car": "carolina panthers",
  "chicago": "chicago bears", "chicago bears": "chicago bears", "chi": "chicago bears",
  "cincinnati": "cincinnati bengals", "cincinnati bengals": "cincinnati bengals", "cin": "cincinnati bengals",
  "cleveland": "cleveland browns", "cleveland browns": "cleveland browns", "cle": "cleveland browns",
  "dallas": "dallas cowboys", "dallas cowboys": "dallas cowboys", "dal": "dallas cowboys",
  "denver": "denver broncos", "denver broncos": "denver broncos", "den": "denver broncos",
  "detroit": "detroit lions", "detroit lions": "detroit lions", "det": "detroit lions",
  "green bay": "green bay packers", "green bay packers": "green bay packers", "packers": "green bay packers", "gb": "green bay packers",
  "houston": "houston texans", "houston texans": "houston texans", "hou": "houston texans",
  "indianapolis": "indianapolis colts", "indianapolis colts": "indianapolis colts", "ind": "indianapolis colts",
  "jacksonville": "jacksonville jaguars", "jacksonville jaguars": "jacksonville jaguars", "jax": "jacksonville jaguars",
  "kansas city": "kansas city chiefs", "kansas city chiefs": "kansas city chiefs", "kc": "kansas city chiefs",
  "las vegas": "las vegas raiders", "las vegas raiders": "las vegas raiders", "lv": "las vegas raiders",
  "chargers": "los angeles chargers", "los angeles chargers": "los angeles chargers", "la chargers": "los angeles chargers", "lac": "los angeles chargers",
  "rams": "los angeles rams", "los angeles rams": "los angeles rams", "la rams": "los angeles rams", "lar": "los angeles rams",
  "miami": "miami dolphins", "miami dolphins": "miami dolphins", "mia": "miami dolphins",
  "minnesota": "minnesota vikings", "minnesota vikings": "minnesota vikings", "min": "minnesota vikings",
  "new england": "new england patriots", "new england patriots": "new england patriots", "patriots": "new england patriots", "ne": "new england patriots",
  "new orleans": "new orleans saints", "new orleans saints": "new orleans saints", "no": "new orleans saints",
  "giants": "new york giants", "new york giants": "new york giants", "ny giants": "new york giants", "nyg": "new york giants",
  "jets": "new york jets", "new york jets": "new york jets", "ny jets": "new york jets", "nyj": "new york jets",
  "philadelphia": "philadelphia eagles", "philadelphia eagles": "philadelphia eagles", "phi": "philadelphia eagles",
  "pittsburgh": "pittsburgh steelers", "pittsburgh steelers": "pittsburgh steelers", "pit": "pittsburgh steelers",
  "san francisco": "san francisco 49ers", "san francisco 49ers": "san francisco 49ers", "49ers": "san francisco 49ers", "sf": "san francisco 49ers",
  "seattle": "seattle seahawks", "seattle seahawks": "seattle seahawks", "sea": "seattle seahawks",
  "tampa bay": "tampa bay buccaneers", "tampa bay buccaneers": "tampa bay buccaneers", "buccaneers": "tampa bay buccaneers", "tb": "tampa bay buccaneers",
  "tennessee": "tennessee titans", "tennessee titans": "tennessee titans", "ten": "tennessee titans",
  "washington": "washington commanders", "washington commanders": "washington commanders", "commanders": "washington commanders", "wsh": "washington commanders", "was": "washington commanders"
};
function normTeam(v) {
  const key = String(v || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\\s+/g, " ");
  return TEAM_ALIASES[key] || key;
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
