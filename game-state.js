"use strict";

// Normalize ESPN's public NFL scoreboard into a provider-neutral game state.
// This module does not infer a missing score, period, clock, or team.
function normalizeScoreboard(payload) {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  return events.map(event => {
    const competition = event?.competitions?.[0];
    const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
    const away = competitors.find(x => x.homeAway === "away") || competitors[0];
    const home = competitors.find(x => x.homeAway === "home") || competitors[1];
    const team = x => ({
      name: String(x?.team?.displayName || x?.team?.name || x?.team?.abbreviation || ""),
      abbreviation: String(x?.team?.abbreviation || ""),
      score: x?.score == null || x.score === "" ? null : Number(x.score)
    });
    const status = competition?.status || event?.status || {};
    const type = status?.type || {};
    const period = Number(status?.period);
    const scoreValid = [away, home].every(x => x && x.score != null && String(x.score).trim() !== "" && Number.isFinite(Number(x.score)));
    const completeTeams = Boolean(away && home && team(away).name && team(home).name);
    return {
      id: String(event?.id || ""),
      name: String(event?.name || ""),
      date: event?.date || null,
      away: team(away || {}),
      home: team(home || {}),
      state: String(type?.state || "unknown"),
      status: String(type?.name || type?.description || "Unknown"),
      completed: type?.completed === true,
      period: Number.isFinite(period) && period > 0 ? period : null,
      clock: status?.displayClock == null ? null : String(status.displayClock),
      scoreValid: scoreValid && completeTeams
    };
  }).filter(g => g.id && g.away.name && g.home.name);
}

function quarterMilestone(game) {
  if (!game || game.completed || game.state !== "in") return null;
  const period = Number(game.period);
  const clock = String(game.clock ?? "").trim();
  if (![1, 2, 3].includes(period) || !/^0{1,2}:00$/.test(clock)) return null;
  return "Q" + period;
}

module.exports = { normalizeScoreboard, quarterMilestone };
