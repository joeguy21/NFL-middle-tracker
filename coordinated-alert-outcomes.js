const { evaluateMargin } = require("./hedge-calculator");

/**
 * Model existing opposing originals plus one new middle wager and an optional hedge.
 * The paired original is already in originalLegs; never count it twice.
 */
function summarizeAlertOutcomes(originalLegs, proposedLegs, middleLeg, pairedOriginal, minMargin, maxMargin) {
  if (!Array.isArray(originalLegs) || originalLegs.length !== 2 ||
      !Array.isArray(proposedLegs) || !middleLeg || !pairedOriginal) {
    throw new Error("Original wagers, one middle wager, and its paired original are required.");
  }
  if (!originalLegs.includes(pairedOriginal) &&
      !originalLegs.some(x => x.team === pairedOriginal.team && x.spread === pairedOriginal.spread &&
        x.stake === pairedOriginal.stake && x.sportsbook === pairedOriginal.sportsbook)) {
    throw new Error("The paired original must be one of the existing wagers.");
  }
  const allLegs = [...originalLegs, ...proposedLegs];
  const stakeTotal = legs => legs.reduce((sum, leg) => sum + leg.stake, 0);
  const originalStake = stakeTotal(originalLegs);
  const proposedStake = stakeTotal(proposedLegs);
  const maxAbsSpread = Math.max(0, ...allLegs.map(leg => Math.abs(leg.spread)));
  const extent = Math.max(100, Math.ceil(maxAbsSpread) + 2);
  minMargin = minMargin ?? -extent;
  maxMargin = maxMargin ?? extent;
  if (!Number.isInteger(minMargin) || !Number.isInteger(maxMargin) || minMargin > maxMargin) {
    throw new Error("Invalid integer margin range.");
  }
  const middleOnlyLegs = [...originalLegs, middleLeg];
  const statusAt = (leg, marginA) => {
    const adjusted = leg.team === "A" ? marginA + leg.spread : -marginA + leg.spread;
    return adjusted > 0 ? "win" : adjusted < 0 ? "loss" : "push";
  };
  const rows = [];
  for (let marginA = minMargin; marginA <= maxMargin; marginA++) {
    const statuses = [pairedOriginal, middleLeg].map(leg => statusAt(leg, marginA));
    rows.push({
      marginA,
      net: Math.round(evaluateMargin(marginA, allLegs) * 100) / 100,
      middleOnlyNet: Math.round(evaluateMargin(marginA, middleOnlyLegs) * 100) / 100,
      middleHit: statuses.every(status => status === "win"),
      pushInMiddle: statuses.includes("push")
    });
  }
  const summarize = values => {
    if (!values.length) return null;
    const nets = values.map(x => x.net);
    return { minNet: Math.min(...nets), maxNet: Math.max(...nets), margins: values.map(x => x.marginA) };
  };
  const inside = rows.filter(x => x.middleHit);
  const outside = rows.filter(x => !x.middleHit && !x.pushInMiddle);
  const teamAOutside = outside.filter(x => x.marginA > 0);
  const teamBOutside = outside.filter(x => x.marginA < 0);
  const tiedOutside = outside.filter(x => x.marginA === 0);
  const middlePushRows = rows.filter(x => x.pushInMiddle);
  const worstOutside = outside.length ? Math.min(...outside.map(x => x.net)) : null;
  const worstMiddleOnlyOutside = outside.length ? Math.min(...outside.map(x => x.middleOnlyNet)) : null;
  return {
    packageExposure: {
      originalStake: Math.round(originalStake * 100) / 100,
      proposedStake: Math.round(proposedStake * 100) / 100,
      totalStaked: Math.round((originalStake + proposedStake) * 100) / 100,
      note: "Total staked is turnover across all legs, not net risk or worst-case loss."
    },
    middleNet: summarize(inside),
    outsideNet: { teamAWin: summarize(teamAOutside), teamBWin: summarize(teamBOutside), tie: summarize(tiedOutside) },
    worstOutsideLossEstimate: worstOutside == null ? null : Math.max(0, -worstOutside),
    hedgeCostIfMiddleMisses: worstOutside == null ? null : Math.max(0, -worstOutside),
    worstOutsideNet: worstOutside,
    hedgeComparison: {
      worstOutsideBeforeHedge: worstMiddleOnlyOutside,
      worstOutsideWithProposedPackage: worstOutside,
      modeledWorstCaseImprovement: worstOutside == null || worstMiddleOnlyOutside == null ? null : Math.round((worstOutside - worstMiddleOnlyOutside) * 100) / 100,
      note: "Compares the middle-only position against all proposed legs. Positive improvement means modeled worst outside-middle net improved; this is not a guarantee."
    },
    middlePushNet: summarize(middlePushRows),
    pushMargins: middlePushRows.map(x => x.marginA),
    evaluatedMarginRange: { min: minMargin, max: maxMargin, scenarioCount: rows.length },
    modelingNotice: "Modeled integer margins only. This is not a complete settlement model; confirm alternate-line push handling, overtime/void rules, quote freshness, and all original wagers before betting."
  };
}
module.exports = { summarizeAlertOutcomes };
