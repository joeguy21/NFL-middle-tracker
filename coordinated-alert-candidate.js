/**
 * Turn a fresh coordinated preview into an alert candidate.
 * Pure function: no delivery, persistence, wager placement, or lifecycle mutation.
 * Callers must separately implement durable deduplication and delivery.
 */
function buildCoordinatedAlertCandidate({record, preview, checkedAt = new Date().toISOString()} = {}) {
  if (!record || record.status !== "tracking") return {eligible:false,reason:"record-not-tracking"};
  if (!preview || preview.ok !== true || !preview.plan) return {eligible:false,reason:"preview-unavailable"};
  const plan = preview.plan;
  const threshold = Number(record.minimumMiddlePoints ?? preview.minimumMiddlePoints ?? 3);
  const middle = plan.bestMiddle || plan.best;
  const hasMiddle = !!middle &&
    Array.isArray(middle.middleLegs) && middle.middleLegs.length === 2 &&
    Number.isFinite(middle.middleWidth) && middle.middleWidth >= threshold;
  const hedge = plan.hedgeRecommendation || null;
  if (!hasMiddle && !hedge) return {eligible:false,reason:"no-current-recommendation"};
  const event = record.event || {};
  // Stable for identical quotes and stakes, but deliberately changes as prices,
  // quote identities, or proposed stake sizing changes.
  const fingerprintData = {
    recordId:record.id,
    middle:hasMiddle ? {
      width:middle.middleWidth,
      legs:middle.middleLegs.map(l=>({team:l.team,spread:l.spread,odds:l.odds,stake:l.stake,book:l.sportsbook,quoteId:l.quoteId||null}))
    } : null,
    hedge:hedge ? {
      originalTeam:hedge.originalTeam,
      leg:hedge.recommendation?.leg ? {
        team:hedge.recommendation.leg.team,spread:hedge.recommendation.leg.spread,
        odds:hedge.recommendation.leg.odds,stake:hedge.recommendation.leg.stake,
        book:hedge.recommendation.leg.sportsbook,quoteId:hedge.recommendation.leg.quoteId||null
      } : null
    }
  };
  // JSON serialization is deterministic because this object is assembled in fixed order.
  const fingerprint = JSON.stringify(fingerprintData);
  return {
    eligible:true,
    fingerprint,
    checkedAt,
    recordId:record.id,
    event:{league:event.league||"nfl",awayTeam:event.awayTeam,homeTeam:event.homeTeam,startTime:event.startTime},
    threshold,
    source:preview.sportsbook || "unverified",
    quoteCount:preview.quoteCount || 0,
    middle:hasMiddle ? {
      width:middle.middleWidth,
      legs:middle.middleLegs,
      outcomeSummary:middle.outcomeSummary || null
    } : null,
    hedge:hedge ? {
      originalTeam:hedge.originalTeam,
      originalTeamName:hedge.originalTeamName,
      originalBook:hedge.originalBook,
      originalStake:hedge.originalStake,
      leg:hedge.recommendation?.leg || null,
      summary:hedge.recommendation?.summary || null
    } : null,
    warning:"Middle and one-original-ticket hedge are independent alternatives, not additive. Quotes are FanDuel-only via FanLine and modeled outcomes are provisional. Verify prices and settlement rules."
  };
}
module.exports={buildCoordinatedAlertCandidate};
