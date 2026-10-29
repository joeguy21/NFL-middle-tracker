const { summarizePlan, profitOnAmericanOdds, settleSpread } = require("./hedge-calculator");

/**
 * Select hedge amounts analytically rather than enumerating every penny.
 * For each modeled final margin, hedge net is affine in stake (win/loss/push).
 * The worst-case objective is the lower envelope of those lines; its maximum
 * occurs at a line intersection or a search-window endpoint. Evaluate nearby
 * cent values to preserve penny precision.
 *
 * Search bounds are computational limits supplied by the caller, not a bet cap.
 * Model is only as complete as summarizePlan's supported settlement rules.
 */
function optimizeSingleLegHedges({ originalLegs, candidates, maxAddedStake, maxTotalStake, stakeStep = 0.01 }) {
  if (!Array.isArray(originalLegs) || !originalLegs.length) throw new Error("Original wagers required.");
  if (!Array.isArray(candidates)) throw new Error("Candidate quotes must be an array.");
  if (!(stakeStep > 0) || !(maxAddedStake >= 0) || !(maxTotalStake > 0)) throw new Error("Invalid search limits.");
  const originalStake = originalLegs.reduce((s, l) => s + l.stake, 0);
  const budget = Math.max(0, Math.min(maxAddedStake, maxTotalStake - originalStake));
  const maxCents = Math.floor((budget + 1e-8) * 100);
  const options = [];
  for (const candidate of candidates) {
    if (!candidate || !["A", "B"].includes(candidate.team) ||
        !Number.isFinite(candidate.spread) || !Number.isFinite(candidate.odds) ||
        candidate.odds === 0) continue;
    const base = summarizePlan(originalLegs, []).rows;
    const unitRows = summarizePlan(originalLegs, [{ ...candidate, stake: 1 }]).rows;
    const lines = base.map((row, i) => ({
      intercept: row.net,
      slope: unitRows[i].net - row.net
    }));
    const cents = new Set([1, maxCents]);
    // Add integer cents adjacent to every pairwise line intersection.
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const denominator = lines[i].slope - lines[j].slope;
        if (Math.abs(denominator) < 1e-12) continue;
        const x = (lines[j].intercept - lines[i].intercept) / denominator;
        if (!Number.isFinite(x) || x < 0 || x > maxCents / 100) continue;
        const center = Math.round(x * 100);
        for (const d of [-1, 0, 1]) {
          const c = center + d;
          if (c >= 1 && c <= maxCents) cents.add(c);
        }
      }
    }
    for (const c of cents) {
      const stake = c / 100;
      const leg = { ...candidate, stake };
      const summary = summarizePlan(originalLegs, [leg]);
      options.push({ leg, summary });
    }
  }
  options.sort((x, y) =>
    y.summary.worstNet - x.summary.worstNet ||
    average(y.summary.rows) - average(x.summary.rows) ||
    x.leg.stake - y.leg.stake
  );
  return {
    best: options[0] || null,
    alternatives: options.slice(0, 10),
    evaluated: options.length,
    availableAddedBudget: budget,
    sizingMethod: "piecewise-linear intersection search at cent precision"
  };
}
function average(rows) { return rows.reduce((s, r) => s + r.net, 0) / rows.length; }

module.exports = { optimizeSingleLegHedges };
