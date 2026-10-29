const { evaluateMargin } = require("./hedge-calculator");

/**
 * Present a planner package as user-facing outcome ranges.
 * This uses the existing integer-margin model and is explicitly provisional:
 * pushes are calculated, but game-specific settlement rules must be verified.
 */
function summarizeAlertOutcomes(originalLegs, proposedLegs, middleLegs, minMargin = -100, maxMargin = 100) {
  if (!Array.isArray(originalLegs) || !originalLegs.length ||
      !Array.isArray(proposedLegs) || !Array.isArray(middleLegs) || middleLegs.length !== 2) {
    throw new Error("Original wagers and a two-leg middle package are required.");
  }
  const allLegs = [...originalLegs, ...proposedLegs];
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
    modelingNotice: "Modeled integer margins only. Scenarios cover integer margins from -100 to +100 only. This is not a complete settlement model; confirm alternate-line push handling, overtime/void rules, quote freshness, and all original wagers before betting."
  };
}
module.exports = { summarizeAlertOutcomes };
