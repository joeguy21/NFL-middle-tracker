"use strict";
(function(root){
 function decimalOdds(american){const n=Number(american);if(!n||!Number.isFinite(n))return null;return n>0?1+n/100:1+100/Math.abs(n)}
 function equalReturnHedge({stake,originalOdds,hedgeOdds}){const s=Number(stake),d=decimalOdds(originalOdds),e=decimalOdds(hedgeOdds);if(!(s>0&&Number.isFinite(s)&&d&&e))throw new Error("Valid positive stake and nonzero American odds required");const hedge=Math.round(s*d/e*100)/100;const originalWins=Math.round((s*(d-1)-hedge)*100)/100;const hedgeWins=Math.round((-s+hedge*(e-1))*100)/100;return {hedge,originalWins,hedgeWins,worstCase:Math.min(originalWins,hedgeWins),totalStake:Math.round((s+hedge)*100)/100,roi:Math.min(originalWins,hedgeWins)/(s+hedge)*100}}
 const api={decimalOdds,equalReturnHedge};if(typeof module!=="undefined"&&module.exports)module.exports=api;root.BetMath=api;
})(typeof globalThis!=="undefined"?globalThis:this);
