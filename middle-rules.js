"use strict";

// Spread handicap is expressed from each selected team's perspective:
// favorite -3 and opponent +7 yields a 4-point middle window (margins 3 through 7).
function middleWindow({ firstTeam, firstSpread, secondTeam, secondSpread }) {
  const a = Number(firstSpread), b = Number(secondSpread);
  if (!firstTeam || !secondTeam || String(firstTeam).toLowerCase() === String(secondTeam).toLowerCase() ||
      !Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error("Two distinct teams and valid spread handicaps are required");
  }
  // Convert second team's spread to first team's score-margin axis.
  const lower = -a;
  const upper = b;
  const width = upper - lower;
  // When first bet's cover requires margin > lower and second bet's cover
  // requires margin < upper, overlap is positive only if upper > lower.
  return {
    firstTeam: String(firstTeam), secondTeam: String(secondTeam),
    lowerMargin: lower, upperMargin: upper,
    width: Math.max(0, width),
    hasMiddle: width > 0,
    qualifies: width > 3
  };
}

function classifyAlert({ middleWidth, quarterMilestone = null }) {
  const width = Number(middleWidth);
  const qualifies = Number.isFinite(width) && width > 3;
  return {
    alertType: qualifies ? "middle" : "hedge",
    qualifies,
    quarterMilestone: ["Q1", "Q2", "Q3"].includes(quarterMilestone) ? quarterMilestone : null
  };
}

module.exports = { middleWindow, classifyAlert };
