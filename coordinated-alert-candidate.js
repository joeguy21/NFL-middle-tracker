/**
 * Middle qualifies to trigger one coordinated middle + hedge recommendation.
 * Pure candidate builder: no delivery or wager placement.
 */
function buildCoordinatedAlertCandidate({record,preview,checkedAt=new Date().toISOString()}={}) {
  if(!record||record.status!=="tracking") return {eligible:false,reason:"record-not-tracking"};
  if(!preview||preview.ok!==true||!preview.plan) return {eligible:false,reason:"preview-unavailable"};
  const plan=preview.plan;
  const threshold=Number(record.minimumMiddlePoints??preview.minimumMiddlePoints??3);
  const middle=plan.bestMiddle||plan.best;
  const hasMiddle=!!middle&&Array.isArray(middle.middleLegs)&&middle.middleLegs.length===1&&
    Number.isFinite(middle.middleWidth)&&middle.middleWidth>=threshold;
  // Hedge is only part of this alert when the middle trigger qualifies.
  if(!hasMiddle) return {eligible:false,reason:"no-qualifying-middle"};
  const hedge=plan.hedgeRecommendation||null;
  const middleLeg=middle.middleLegs[0];
  const hedgeLeg=hedge?.recommendation?.leg||null;
  const distinctBooks=!!hedgeLeg&&String(hedgeLeg.sportsbook).trim().toLowerCase()!==String(middleLeg.sportsbook).trim().toLowerCase();
  const validHedge=distinctBooks?hedge:null;
  const event=record.event||{};
  const fingerprint=JSON.stringify({
    recordId:record.id,width:middle.middleWidth,
    middle:{team:middleLeg.team,spread:middleLeg.spread,odds:middleLeg.odds,stake:middleLeg.stake,book:middleLeg.sportsbook,quoteId:middleLeg.quoteId||null},
    hedge:validHedge?{target:validHedge.originalTeam,team:hedgeLeg.team,spread:hedgeLeg.spread,odds:hedgeLeg.odds,stake:hedgeLeg.stake,book:hedgeLeg.sportsbook,quoteId:hedgeLeg.quoteId||null}:null
  });
  return {
    eligible:true,fingerprint,checkedAt,recordId:record.id,
    event:{league:event.league||"nfl",awayTeam:event.awayTeam,homeTeam:event.homeTeam,startTime:event.startTime},
    threshold,source:preview.sportsbook||"selected sportsbook feeds",
    quoteCount:preview.quoteCount||0,
    middle:{width:middle.middleWidth,pairedOriginal:middle.pairedOriginal,
      leg:middleLeg,outcomeSummary:middle.outcomeSummary||null},
    hedge:validHedge?{
      originalTeam:validHedge.originalTeam,originalTeamName:validHedge.originalTeamName,
      originalBook:validHedge.originalBook,originalStake:validHedge.originalStake,
      leg:hedgeLeg,summary:validHedge.recommendation.summary||null
    }:null,
    hedgeUnavailableReason:validHedge?null:(middle.hedgeUnavailableReason||"No valid different-book hedge quote at the trigger snapshot."),
    warning:"A qualifying middle triggers this combined recommendation. The middle wager and hedge must use different sportsbooks. Full-portfolio projections are provisional and depend on quote coverage and settlement modeling."
  };
}
module.exports={buildCoordinatedAlertCandidate};
