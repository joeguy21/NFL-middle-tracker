const { eligibleQuotes } = require("./odds-eligibility");
const { summarizePlan } = require("./hedge-calculator");
const { optimizeSingleLegHedges } = require("./hedge-optimizer");
const { summarizeAlertOutcomes } = require("./coordinated-alert-outcomes");

/**
 * Prototype middle-first coordinated planner.
 * Quotes must already be normalized to one game, spread market, and settlement rules.
 * Spread convention: Team A signed spread + Team B signed spread = middle width.
 * Uses the current integer-margin scenario engine; not production-ready for settlement.
 */
function planMiddleFirst({
  originalLegs,
  quotes,
  originalBooks = {},
  minMiddleWidth = 3,
  maxAddedStake = 300,
  maxTotalStake = 500,
  stakeStep = 5,
  hedgeCandidates = [],
  nowMs,
  maxQuoteAgeMs = 30000
}) {
  if (!Array.isArray(originalLegs) || !originalLegs.length) throw new Error("Original wagers required.");
  if (!Array.isArray(quotes)) throw new Error("Spread quotes must be an array.");
  if (!(minMiddleWidth >= 0) || !(stakeStep > 0) || !(maxAddedStake >= 0) || !(maxTotalStake > 0)) {
    throw new Error("Invalid planner limits.");
  }
  const options = { nowMs, maxQuoteAgeMs };
  const eligible = eligibleQuotes(quotes, originalBooks, options);
  const aQuotes = eligible.filter(q => q.team === "A");
  const bQuotes = eligible.filter(q => q.team === "B");
  const originalStake = originalLegs.reduce((sum, leg) => sum + leg.stake, 0);
  const budget = Math.max(0, Math.min(maxAddedStake, maxTotalStake - originalStake));
  const maxSteps = Math.floor((budget + 1e-8) / stakeStep);
  const plans = [];

  const sameMarket = (a, b) => {
    // Missing market identity is not safe enough to combine.
    const required = ["eventId", "league", "category", "period", "marketType"];
    if (required.some(k => a[k] == null || b[k] == null || String(a[k]) === "" || String(b[k]) === "")) return false;
    return required.every(k => String(a[k]).trim().toLowerCase() === String(b[k]).trim().toLowerCase());
  };
  for (const a of aQuotes) for (const b of bQuotes) {
    // Both quotes must identify the same event and market context.
    if (!sameMarket(a, b)) continue;
    // Team A and B must be opposing sides of the same normalized market.
    const width = Math.round((a.spread + b.spread) * 100) / 100;
    if (width + 1e-8 < minMiddleWidth) continue;
    for (let aStep = 1; aStep <= maxSteps; aStep++) {
      const stakeA = Math.round(aStep * stakeStep * 100) / 100;
      for (let bStep = 1; bStep <= maxSteps - aStep; bStep++) {
        const stakeB = Math.round(bStep * stakeStep * 100) / 100;
        const middleLegs = [
          { team: "A", spread: a.spread, odds: a.odds, stake: stakeA, sportsbook: a.sportsbook, quoteId: a.quoteId },
          { team: "B", spread: b.spread, odds: b.odds, stake: stakeB, sportsbook: b.sportsbook, quoteId: b.quoteId }
        ];
        
        let bestHedge = null;
        if (hedgeCandidates.length) {
          const validHedges = eligibleQuotes(hedgeCandidates, originalBooks, options)
            .filter(q => !(q.quoteId && [a.quoteId, b.quoteId].includes(q.quoteId)))
            .map(q => ({ team: q.team, spread: q.spread, odds: q.odds, sportsbook: q.sportsbook, quoteId: q.quoteId }));
          bestHedge = optimizeSingleLegHedges({
            originalLegs: [...originalLegs, ...middleLegs],
            candidates: validHedges,
            maxAddedStake: Math.max(0, budget - stakeA - stakeB),
            maxTotalStake,
            stakeStep
          }).best;
        }
        const selectedHedge = bestHedge && bestHedge.leg;
        const legs = selectedHedge ? [...middleLegs, selectedHedge] : middleLegs;
        const summary = summarizePlan(originalLegs, legs);
        const outcomeSummary = summarizeAlertOutcomes(originalLegs, legs, middleLegs);
        plans.push({
          middleWidth: width,
          middleLegs,
          hedgeLeg: selectedHedge,
          legs,
          summary,
          outcomeSummary,
          jointEvaluation: {
            totalExposure: outcomeSummary.packageExposure.totalStaked,
            worstOutsideNet: outcomeSummary.worstOutsideNet,
            middleHitNet: outcomeSummary.middleNet,
            worstCaseImprovement: outcomeSummary.hedgeComparison.modeledWorstCaseImprovement,
            decisionBasis: "All selected legs evaluated together across the integer-margin scenario range; provisional settlement model."
          },
          quoteTimestamps: [a.timestampMs, b.timestampMs],
          quoteIds: [a.quoteId, b.quoteId].filter(Boolean)
        });
      }
    }
  }
  // Analyze each saved original ticket independently. These are single-ticket
  // hedge candidates, not automatically additive: the coordinated budget still
  // must be checked before combining recommendations.
  const independentPositions = originalLegs.map(original => {
    const opposingTeam = original.team === "A" ? "B" : "A";
    const candidates = eligible.filter(q => q.team === opposingTeam)
      .map(q => ({team:q.team,spread:q.spread,odds:q.odds,sportsbook:q.sportsbook,quoteId:q.quoteId}));
    const result = optimizeSingleLegHedges({
      originalLegs:[original], candidates,
      maxAddedStake:budget, maxTotalStake,
      stakeStep
    });
    return {
      originalTeam:original.team,
      originalTeamName:original.teamName || original.team,
      originalBook:original.sportsbook,
      originalStake:original.stake,
      opposingTeam,
      bestHedge:result.best,
      alternatives:result.alternatives,
      evaluated:result.evaluated,
      note:"Ticket-level comparison only. Do not add independently optimized stakes together without recomputing the full coordinated package."
    };
  });
  // Rank using the jointly settled complete package, not a ticket's
  // independently optimized hedge score. Favor downside outside the
  // middle first, then middle width, then lower incremental exposure.
  plans.sort((x, y) =>
    (y.outcomeSummary.worstOutsideNet ?? -Infinity) - (x.outcomeSummary.worstOutsideNet ?? -Infinity) ||
    y.middleWidth - x.middleWidth ||
    x.summary.addedStake - y.summary.addedStake
  );
  // Present the best middle and one standalone hedge choice side by side.
  // The hedge optimizer evaluates each original ticket separately; select ONE
  // ticket's hedge only. Never combine the two independent ticket hedge outputs.
  const hedgeChoices = independentPositions
    .filter(position => position.bestHedge)
    .map(position => ({
      originalTeam: position.originalTeam,
      originalTeamName: position.originalTeamName,
      originalBook: position.originalBook,
      originalStake: position.originalStake,
      opposingTeam: position.opposingTeam,
      recommendation: position.bestHedge
    }));
  hedgeChoices.sort((x, y) =>
    (y.recommendation.summary.worstNet ?? -Infinity) -
      (x.recommendation.summary.worstNet ?? -Infinity) ||
    x.recommendation.leg.stake - y.recommendation.leg.stake
  );
  return {
    best: plans[0] || null,
    bestMiddle: plans[0] || null,
    // This is a single selected hedge alternative, not an add-on to the middle.
    hedgeRecommendation: hedgeChoices[0] || null,
    hedgeAlternatives: hedgeChoices,
    alternatives: plans.slice(0, 10),
    qualifyingPackages: plans.length,
    independentPositions,
    eligibleQuoteCount: eligible.length,
    availableAddedBudget: budget,
    recommendationModes: ["middle", "single-original-ticket-hedge"],
    warning: "Middle and hedge are separate recommendations. The hedge is against one original ticket only. Prototype integer-margin estimates are not guaranteed settlement outcomes. Revalidate quotes and complete settlement modeling before action."
  };
}
module.exports = { planMiddleFirst };
