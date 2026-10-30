const { eligibleQuotes, normalizeBook } = require("./odds-eligibility");
const { summarizePlan, profitOnAmericanOdds } = require("./hedge-calculator");
const { optimizeSingleLegHedges } = require("./hedge-optimizer");
const { summarizeAlertOutcomes } = require("./coordinated-alert-outcomes");

/**
 * A middle is one new live wager paired with one saved original ticket.
 * The coordinated hedge is the other original ticket, at a different sportsbook.
 * Quote snapshots must be normalized to one game/market by the caller.
 */
function planMiddleFirst({
  originalLegs, quotes, originalBooks = {}, minMiddleWidth = 3,
  stakeStep = 0.01,
  nowMs, maxQuoteAgeMs = 30000
}) {
  if (!Array.isArray(originalLegs) || originalLegs.length !== 2 ||
      new Set(originalLegs.map(x => x.team)).size !== 2) {
    throw new Error("Exactly two opposing original wagers are required.");
  }
  if (!Array.isArray(quotes)) throw new Error("Spread quotes must be an array.");
  if (!(minMiddleWidth >= 0) || !(stakeStep > 0)) throw new Error("Invalid planner settings.");
  const options = { nowMs, maxQuoteAgeMs };
  const eligible = eligibleQuotes(quotes, originalBooks, options);
  const originalStake = originalLegs.reduce((s,l)=>s+l.stake,0);
  // No account/game exposure ceiling. Keep a practical search window derived from existing ticket size; this only bounds optimization work, not the amount a user may bet.
  const budget = Math.max(stakeStep, originalStake * 3);
  const sameMarket = (a,b) => {
    const keys=["eventId","league","category","period","marketType"];
    return keys.every(k=>a[k]!=null && b[k]!=null && String(a[k]).trim()!=="" &&
      String(a[k]).trim().toLowerCase()===String(b[k]).trim().toLowerCase());
  };
  const plans=[];
  for (const pairedOriginal of originalLegs) {
    const newTeam=pairedOriginal.team==="A"?"B":"A";
    const otherOriginal=originalLegs.find(l=>l!==pairedOriginal);
    for (const q of eligible.filter(x=>x.team===newTeam)) {
      const width=Math.round((pairedOriginal.spread+q.spread)*100)/100;
      if (width+1e-8<minMiddleWidth || budget<stakeStep) continue;
      // Size middle to offset the paired original's win profit when the new
      // opposing wager loses. This targets the paired slice, not whole package.
      const middleStake=Math.round(profitOnAmericanOdds(pairedOriginal.stake,pairedOriginal.odds)*100)/100;
      const middleLeg={team:q.team,spread:q.spread,odds:q.odds,stake:middleStake,
        sportsbook:q.sportsbook,quoteId:q.quoteId,timestampMs:q.timestampMs};
      // Hedge is a separate alternative targeting the other saved original ticket.
      // Enforce the distinct-book rule before searching.
      const hedgeCandidates=eligible.filter(h=>h.team!==otherOriginal.team &&
        normalizeBook(h.sportsbook)!==normalizeBook(middleLeg.sportsbook) &&
        sameMarket(q,h)).map(h=>({team:h.team,spread:h.spread,odds:h.odds,
          sportsbook:h.sportsbook,quoteId:h.quoteId,timestampMs:h.timestampMs}));
      const remainingSearchWindow=Math.max(0,budget-middleStake);
      const packageBase=[...originalLegs,middleLeg];
      const hedgeResult=optimizeSingleLegHedges({
        // Optimize the hedge against the complete package, not the target ticket in isolation.
        originalLegs:packageBase,candidates:hedgeCandidates,
        maxAddedStake:remainingSearchWindow,
        maxTotalStake:packageBase.reduce((s,l)=>s+l.stake,0)+remainingSearchWindow,
        stakeStep
      });
      const hedge=hedgeResult.best;
      // Size hedge on its target ticket first; keep total portfolio math separate.
      const proposed=[middleLeg,...(hedge?[hedge.leg]:[])];
      const summary=summarizePlan(originalLegs,proposed);
      const outcomeSummary=summarizeAlertOutcomes(originalLegs,proposed,middleLeg,pairedOriginal);
      plans.push({
        middleWidth:width,
        middleLegs:[middleLeg],
        pairedOriginal:{team:pairedOriginal.team,spread:pairedOriginal.spread,stake:pairedOriginal.stake,sportsbook:pairedOriginal.sportsbook},
        middleQuoteTimestamp:middleLeg.timestampMs,
        hedgeRecommendation:hedge?{
          originalTeam:otherOriginal.team,originalTeamName:otherOriginal.teamName||otherOriginal.team,
          originalBook:otherOriginal.sportsbook,originalStake:otherOriginal.stake,
          opposingTeam:otherOriginal.team==="A"?"B":"A",recommendation:hedge
        }:null,
        hedgeUnavailableReason:hedge?null:"No valid different-book hedge quote/stake available at this snapshot.",
        legs:proposed,summary,outcomeSummary,
        quoteTimestamps:[middleLeg.timestampMs,hedge?.leg?.timestampMs].filter(Number.isFinite),
        quoteIds:[middleLeg.quoteId,hedge?.leg?.quoteId].filter(Boolean)
      });
    }
  }
  // Primary rule: widest qualifying middle. Same exact line: strongest price.
  plans.sort((a,b)=>b.middleWidth-a.middleWidth ||
    (b.middleLegs[0].odds-a.middleLegs[0].odds) ||
    (a.middleLegs[0].stake-b.middleLegs[0].stake));
  const best=plans[0]||null;
  return {
    best,bestMiddle:best,
    hedgeRecommendation:best?.hedgeRecommendation||null,
    hedgeAlternatives:best?.hedgeRecommendation?[best.hedgeRecommendation]:[],
    alternatives:plans.slice(0,10),qualifyingPackages:plans.length,
    eligibleQuoteCount:eligible.length,optimizationSearchWindow:budget,
    recommendationModes:["qualifying-middle-trigger","distinct-book-hedge"],
    warning:"A qualifying middle triggers the coordinated recommendation. Middle is one new wager paired with one original ticket; hedge targets the other original ticket and must use a different sportsbook. Quotes shown only reflect supplied sportsbook feeds. Outcome estimates are provisional."
  };
}
module.exports={planMiddleFirst};
