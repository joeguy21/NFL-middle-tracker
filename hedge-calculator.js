/**
 * Middle Tracker settlement math (isolated, not wired into app).
 * Margin convention: marginA = Team A points - Team B points.
 * spreadA is Team A's signed line; spreadB is Team B's signed line.
 * For a Team B wager, its adjusted margin is -marginA + spreadB.
 */
function profitOnAmericanOdds(stake, odds) {
  if (!(stake > 0) || !Number.isFinite(odds) || odds === 0) throw new Error("Invalid stake or American odds.");
  return odds > 0 ? stake * odds / 100 : stake * 100 / Math.abs(odds);
}
function settleSpread(margin, team, spread) {
  if (!Number.isFinite(spread) || Math.abs(spread * 2 - Math.round(spread * 2)) > 1e-9) {
    throw new Error("Quarter-point spreads require split-stake settlement and are not supported by this calculator.");
  }
  if (!Number.isFinite(margin) || !["A", "B"].includes(team)) throw new Error("Invalid margin or team.");
  const adjusted = team === "A" ? margin + spread : -margin + spread;
  return adjusted > 0 ? "win" : adjusted < 0 ? "loss" : "push";
}
function settleLeg(margin, leg) {
  const result = settleSpread(margin, leg.team, leg.spread);
  if (result === "push") return 0;
  return result === "win" ? profitOnAmericanOdds(leg.stake, leg.odds) : -leg.stake;
}
function evaluateMargin(margin, legs) {
  return legs.reduce((sum, leg) => sum + settleLeg(margin, leg), 0);
}
function scenarioTable(originalLegs, proposedLegs = [], minMargin = -60, maxMargin = 60) {
  if (!Array.isArray(originalLegs) || originalLegs.length === 0) throw new Error("Enter at least one original wager.");
  const legs = [...originalLegs, ...proposedLegs];
  const rows = [];
  for (let m = minMargin; m <= maxMargin; m++) {
    const net = evaluateMargin(m, legs);
    rows.push({ marginA: m, net: Math.round(net * 100) / 100 });
  }
  return rows;
}
function summarizePlan(originalLegs, proposedLegs = []) {
  const rows = scenarioTable(originalLegs, proposedLegs);
  const values = rows.map(r => r.net);
  const best = Math.max(...values), worst = Math.min(...values);
  const proposedStake = proposedLegs.reduce((s, l) => s + l.stake, 0);
  return {
    totalOriginalStake: originalLegs.reduce((s, l) => s + l.stake, 0),
    addedStake: proposedStake,
    totalStaked: originalLegs.reduce((s, l) => s + l.stake, 0) + proposedStake,
    bestNet: Math.round(best * 100) / 100,
    worstNet: Math.round(worst * 100) / 100,
    worstMargins: rows.filter(r => r.net === worst).map(r => r.marginA),
    bestMargins: rows.filter(r => r.net === best).map(r => r.marginA),
    rows
  };
}
if (typeof module !== "undefined") module.exports = { profitOnAmericanOdds, settleSpread, settleLeg, evaluateMargin, scenarioTable, summarizePlan };
