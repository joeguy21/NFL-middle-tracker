/**
 * Evaluates the settlement geometry of two original opposing spread wagers.
 * Spread values are entered from each team's perspective (e.g. +3.5 / -1.5).
 * Width = sum of the two team-perspective spreads. Positive width is a middle.
 * This module reports geometry only; it does not estimate pushes, vig, or settlement.
 */
function middleWidth(legs) {
  if (!Array.isArray(legs) || legs.length !== 2) throw new Error("Exactly two original legs are required.");
  const [a,b]=legs;
  if (!a || !b || !["A","B"].includes(a.team) || !["A","B"].includes(b.team) ||
      a.team===b.team || !Number.isFinite(a.spread) || !Number.isFinite(b.spread))
    throw new Error("Legs must be valid opposing team spreads.");
  return Number((a.spread+b.spread).toFixed(4));
}
function inspectMiddleThreshold(legs, minimumPoints=3) {
  if (!Number.isFinite(minimumPoints)||minimumPoints<0) throw new Error("Minimum width must be a nonnegative number.");
  const width=middleWidth(legs);
  return {width,minimumPoints,qualifies:width>0 && width>=minimumPoints};
}
module.exports={middleWidth,inspectMiddleThreshold};
