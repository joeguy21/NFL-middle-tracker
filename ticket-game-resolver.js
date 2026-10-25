"use strict";

// Resolve tracked tickets to one normalized scoreboard event.
// Refuses uncertainty: never falls back to a fuzzy/substring team match.
const TEAM_CODES = {
  "arizona cardinals":"ari","ari":"ari","atlanta falcons":"atl","atl":"atl",
  "baltimore ravens":"bal","bal":"bal","buffalo bills":"buf","buf":"buf",
  "carolina panthers":"car","car":"car","chicago bears":"chi","chi":"chi",
  "cincinnati bengals":"cin","cin":"cin","cleveland browns":"cle","cle":"cle",
  "dallas cowboys":"dal","dal":"dal","denver broncos":"den","den":"den",
  "detroit lions":"det","det":"det","green bay packers":"gb","gb":"gb",
  "houston texans":"hou","hou":"hou","indianapolis colts":"ind","ind":"ind",
  "jacksonville jaguars":"jax","jax":"jax","kansas city chiefs":"kc","kc":"kc",
  "las vegas raiders":"lv","lv":"lv","los angeles chargers":"lac","lac":"lac",
  "los angeles rams":"lar","lar":"lar","miami dolphins":"mia","mia":"mia",
  "minnesota vikings":"min","min":"min","new england patriots":"ne","ne":"ne",
  "new orleans saints":"no","no":"no","new york giants":"nyg","nyg":"nyg",
  "new york jets":"nyj","nyj":"nyj","philadelphia eagles":"phi","phi":"phi",
  "pittsburgh steelers":"pit","pit":"pit","san francisco 49ers":"sf","sf":"sf",
  "seattle seahawks":"sea","sea":"sea","tampa bay buccaneers":"tb","tb":"tb",
  "tennessee titans":"ten","ten":"ten","washington commanders":"wsh","wsh":"wsh"
};
function teamCode(value) {
  const key = String(value ?? "").trim().toLowerCase().replace(/\s+/g," ");
  return TEAM_CODES[key] || null;
}
function hasTicketTeams(ticket, game) {
  const a = teamCode(ticket.team), b = teamCode(ticket.opp);
  const away = teamCode(game.away?.abbreviation || game.away?.name);
  const home = teamCode(game.home?.abbreviation || game.home?.name);
  return Boolean(a && b && away && home && a !== b &&
    ((a === away && b === home) || (a === home && b === away)));
}
function resolveTicketGame(ticket, games) {
  if (!ticket || !Array.isArray(games)) return { resolved:false, reason:"invalid-input" };
  const explicit = ticket.gameId == null ? "" : String(ticket.gameId).trim();
  if (explicit) {
    const matches = games.filter(g => String(g?.id ?? "") === explicit);
    if (matches.length !== 1) return { resolved:false, reason:matches.length ? "ambiguous-event-id" : "event-not-found" };
    if (!hasTicketTeams(ticket, matches[0])) return { resolved:false, reason:"event-team-mismatch" };
    return { resolved:true, game:matches[0], method:"event-id" };
  }
  if (!ticket.team || !ticket.opp) return { resolved:false, reason:"missing-team-pair" };
  const matches = games.filter(g => hasTicketTeams(ticket,g));
  if (matches.length !== 1) return { resolved:false, reason:matches.length ? "ambiguous-matchup" : "matchup-not-found" };
  return { resolved:true, game:matches[0], method:"unique-matchup" };
}
module.exports = { resolveTicketGame, teamCode };
