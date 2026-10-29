const { canonicalizeFanLineQuotes } = require("./canonicalize-fanline-quotes");
const { planMiddleFirst } = require("./coordinated-middle-planner");
const { summarizeAlertOutcomes } = require("./coordinated-alert-outcomes");

/**
 * Build a read-only plan preview for one saved coordinated game.
 * FanLine is currently attributed ONLY to FanDuel. Never relabel its prices
 * as other operators. Caller must fetch the current payload and supply it here.
 */
function previewCoordinatedPlan({
  record, payload, nowMs = Date.now(), sportsbook = "FanDuel",
  minMiddleWidth, maxAddedStake = 300, maxTotalStake = 500,
  stakeStep = 5, maxQuoteAgeMs = 30000
} = {}) {
  if (!record || !record.event || !Array.isArray(record.originalLegs) || record.originalLegs.length !== 2) {
    throw new Error("A saved game with exactly two original wagers is required.");
  }
  const legs = record.originalLegs;
  if (legs.some(x => !["A", "B"].includes(x.team)) ||
      new Set(legs.map(x => x.team)).size !== 2 ||
      legs.some(x => !Number.isFinite(x.stake) || x.stake <= 0 ||
        !Number.isFinite(x.spread) || !Number.isFinite(x.odds) || x.odds === 0 ||
        !x.sportsbook)) {
    throw new Error("Saved original wagers are incomplete or invalid.");
  }
  if (legs.some(x => Math.abs(x.spread * 2 - Math.round(x.spread * 2)) > 1e-9)) {
    throw new Error("Saved original quarter-point spreads require split-stake settlement and are not supported.");
  }
  const event = record.event;
  const teamA = event.teamA || event.teams?.A || event.awayTeam;
  const teamB = event.teamB || event.teams?.B || event.homeTeam;
  if (!teamA || !teamB || String(teamA).toLowerCase() === String(teamB).toLowerCase()) {
    throw new Error("Saved game must identify distinct Team A and Team B.");
  }
  const selectedEvent = {
    league: event.league || "nfl",
    awayTeam: event.awayTeam || teamA,
    homeTeam: event.homeTeam || teamB,
    startTime: event.startTime || event.commenceTime || event.kickoff
  };
  const quotes = canonicalizeFanLineQuotes(payload, {
    selectedEvent, teamA, teamB, sportsbook, nowMs, maxAgeMs: maxQuoteAgeMs
  });
  if (!quotes.length) {
    return {
      ok: false, reason: "No unambiguous, fresh, matchup-matched FanDuel spread quotes.",
      sportsbook, quoteCount: 0, plan: null
    };
  }
  const originalBooks = {};
  for (const leg of legs) originalBooks[leg.team] = leg.sportsbook;
  const plan = planMiddleFirst({
    originalLegs: legs, quotes, originalBooks,
    minMiddleWidth: minMiddleWidth ?? record.minimumMiddlePoints ?? 3,
    maxAddedStake, maxTotalStake, stakeStep, nowMs, maxQuoteAgeMs
  });
  // Attach modeled outcome details to every displayed package. This is read-only;
  // the preview never records or places a wager.
  if (plan.best) {
    plan.best.outcomeSummary = summarizeAlertOutcomes(
      legs, plan.best.legs, plan.best.middleLegs
    );
  }
  plan.alternatives = plan.alternatives.map(option => ({
    ...option,
    outcomeSummary: summarizeAlertOutcomes(legs, option.legs, option.middleLegs)
  }));
  return {
    ok: true, sportsbook, quoteCount: quotes.length,
    minimumMiddlePoints: minMiddleWidth ?? record.minimumMiddlePoints ?? 3,
    plan
  };
}
module.exports = { previewCoordinatedPlan };
