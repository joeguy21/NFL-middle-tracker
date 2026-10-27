const { summarizePlan } = require("./hedge-calculator");

/**
 * First-pass recommendation ranking for candidate single-leg hedges.
 * All amounts are rounded to stakeStep. Search is bounded by maxAddedStake
 * and maxTotalStake. This does not yet model league-specific settlement rules,
 * parlays, voids, OT exclusions, or correlated/partial fills.
 */
function optimizeSingleLegHedges({ originalLegs, candidates, maxAddedStake, maxTotalStake, stakeStep = 1 }) {
  if (!Array.isArray(originalLegs) || !originalLegs.length) throw new Error("Original wagers required.");
  if (!Array.isArray(candidates)) throw new Error("Candidate quotes must be an array.");
  if (!(stakeStep > 0) || !(maxAddedStake >= 0) || !(maxTotalStake > 0)) throw new Error("Invalid search limits.");
  const originalStake = originalLegs.reduce((s, l) => s + l.stake, 0);
  const budget = Math.max(0, Math.min(maxAddedStake, maxTotalStake - originalStake));
  const maxSteps = Math.floor((budget + 1e-8) / stakeStep);
  const options = [];
  for (const candidate of candidates) {
    if (!candidate || !["A", "B"].includes(candidate.team) ||
        !Number.isFinite(candidate.spread) || !Number.isFinite(candidate.odds) ||
        candidate.odds === 0) continue;
    for (let step = 1; step <= maxSteps; step++) {
      const stake = Math.round(step * stakeStep * 100) / 100;
      const leg = { ...candidate, stake };
      const summary = summarizePlan(originalLegs, [leg]);
      options.push({ leg, summary });
    }
  }
  // Primary objective: maximize the worst modeled result (downside floor).
  // Tie-break: better average modeled net, then smaller added stake.
  options.sort((x, y) =>
    y.summary.worstNet - x.summary.worstNet ||
    average(y.summary.rows) - average(x.summary.rows) ||
    x.leg.stake - y.leg.stake
  );
  return { best: options[0] || null, alternatives: options.slice(0, 10), evaluated: options.length, availableAddedBudget: budget };
}
function average(rows) { return rows.reduce((s, r) => s + r.net, 0) / rows.length; }

module.exports = { optimizeSingleLegHedges };
