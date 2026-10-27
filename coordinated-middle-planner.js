const { eligibleQuotes } = require("./odds-eligibility");
const { summarizePlan } = require("./hedge-calculator");
const { optimizeSingleLegHedges } = require("./hedge-optimizer");

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
        plans.push({
          middleWidth: width,
          middleLegs,
          hedgeLeg: selectedHedge,
          legs,
          summary,
          quoteTimestamps: [a.timestampMs, b.timestampMs],
          quoteIds: [a.quoteId, b.quoteId].filter(Boolean)
        });
      }
    }
  }
  plans.sort((x, y) =>
    y.summary.worstNet - x.summary.worstNet ||
    y.middleWidth - x.middleWidth ||
    x.summary.addedStake - y.summary.addedStake
  );
  return {
    best: plans[0] || null,
    alternatives: plans.slice(0, 10),
    qualifyingPackages: plans.length,
    eligibleQuoteCount: eligible.length,
    availableAddedBudget: budget,
    warning: "Prototype only: integer-margin scenarios do not cover full settlement outcomes. Revalidate quotes and complete settlement modeling before action."
  };
}
module.exports = { planMiddleFirst };
