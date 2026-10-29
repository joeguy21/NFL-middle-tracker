const { evaluateMargin } = require("./hedge-calculator");

/**
 * Present a planner package as user-facing outcome ranges.
 * This uses the existing integer-margin model and is explicitly provisional:
 * pushes are calculated, but game-specific settlement rules must be verified.
 */
function summarizeAlertOutcomes(originalLegs, proposedLegs, middleLegs, minMargin, maxMargin) {
  if (!Array.isArray(originalLegs) || !originalLegs.length ||
      !Array.isArray(proposedLegs) || !Array.isArray(middleLegs) || middleLegs.length !== 2) {
    throw new Error("Original wagers and a two-leg middle package are required.");
  }
  const allLegs = [...originalLegs, ...proposedLegs];
  const stakeTotal = legs => legs.reduce((sum, leg) => sum + leg.stake, 0);
  const originalStake = stakeTotal(originalLegs);
  const proposedStake = stakeTotal(proposedLegs);
  // Include representative tails beyond every line threshold so a high alternate spread
  // cannot silently fall outside the modeled range. Retain at least +/-100 scenarios.
  const maxAbsSpread = Math.max(0, ...allLegs.map(leg => Math.abs(leg.spread)),
    ...middleLegs.map(leg => Math.abs(leg.spread)));
  const extent = Math.max(100, Math.ceil(maxAbsSpread) + 2);
  minMargin = minMargin ?? -extent;
  maxMargin = maxMargin ?? extent;
  if (!Number.isInteger(minMargin) || !Number.isInteger(maxMargin) || minMargin > maxMargin) {
    throw new Error("Invalid integer margin range.");
  }
  const rows = [];
  for (let marginA = minMargin; marginA <= maxMargin; marginA++) {
    const statuses = middleLegs.map(leg => {
      const adjusted = leg.team === "A" ? marginA + leg.spread : -marginA + leg.spread;
      return adjusted > 0 ? "win" : adjusted < 0 ? "loss" : "push";
    });
    rows.push({
      marginA,
      net: Math.round(evaluateMargin(marginA, allLegs) * 100) / 100,
      middleHit: statuses.every(status => status === "win"),
      pushInMiddle: statuses.includes("push")
    });
  }
  const summarize = values => {
    if (!values.length) return null;
    const nets = values.map(x => x.net);
    return {
      minNet: Math.min(...nets),
      maxNet: Math.max(...nets),
      margins: values.map(x => x.marginA)
    };
  };
  const inside = rows.filter(x => x.middleHit);
  const outside = rows.filter(x => !x.middleHit && !x.pushInMiddle);
  const teamAOutside = outside.filter(x => x.marginA > 0);
  const teamBOutside = outside.filter(x => x.marginA < 0);
  const tiedOutside = outside.filter(x => x.marginA === 0);
  const middlePushRows = rows.filter(x => x.pushInMiddle);
  const worstOutside = outside.length ? Math.min(...outside.map(x => x.net)) : null;
  return {
    packageExposure: {
      originalStake: Math.round(originalStake * 100) / 100,
      proposedStake: Math.round(proposedStake * 100) / 100,
      totalStaked: Math.round((originalStake + proposedStake) * 100) / 100,
      // Stake exposure is amount wagered, not maximum possible loss.
      note: "Total staked is turnover across all legs, not net risk or worst-case loss."
    },
    middleNet: summarize(inside),
    outsideNet: {
      teamAWin: summarize(teamAOutside),
      teamBWin: summarize(teamBOutside),
      tie: summarize(tiedOutside)
    },
    // This is the worst modeled combined package loss outside the middle, not the incremental cost of a hedge.
    worstOutsideLossEstimate: worstOutside == null ? null : Math.max(0, -worstOutside),
    // Backward-compatible legacy field; deprecated because its name overstates what it measures.
    hedgeCostIfMiddleMisses: worstOutside == null ? null : Math.max(0, -worstOutside),
    worstOutsideNet: worstOutside,
    middlePushNet: summarize(middlePushRows),
    pushMargins: middlePushRows.map(x => x.marginA),
    evaluatedMarginRange: { min: minMargin, max: maxMargin, scenarioCount: rows.length },
    modelingNotice: "Modeled integer margins only. Scenarios cover integer margins across the reported range, extended beyond wager thresholds. This is not a complete settlement model; confirm alternate-line push handling, overtime/void rules, quote freshness, and all original wagers before betting."
  };
}
module.exports = { summarizeAlertOutcomes };
