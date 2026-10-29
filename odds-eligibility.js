/**
 * Quote eligibility rules for middle-first planner.
 * This module filters candidates only; it does not assert feed coverage or legal access.
 */
function normalizeBook(value) {
  return String(value || "").trim().toLowerCase();
}
function isEligibleQuote(quote, exclusions = {}, options = {}) {
  if (!quote || !["A", "B"].includes(quote.team)) return false;
  if (!Number.isFinite(quote.spread) || !Number.isFinite(quote.odds) || quote.odds === 0) return false;
  // Only whole- and half-point spreads are modeled. Quarter-points require split settlement.
  if (Math.abs(quote.spread * 2 - Math.round(quote.spread * 2)) > 1e-9) return false;
  if (!quote.sportsbook || !String(quote.sportsbook).trim()) return false;
  if (options.nowMs != null) {
    if (!Number.isFinite(quote.timestampMs)) return false;
    const ageMs = options.nowMs - quote.timestampMs;
    if (ageMs < 0 || ageMs > (options.maxQuoteAgeMs ?? 30000)) return false;
  }
  const blocked = normalizeBook(exclusions[quote.team]);
  return !blocked || normalizeBook(quote.sportsbook) !== blocked;
}
function eligibleQuotes(quotes, exclusions = {}, options = {}) {
  if (!Array.isArray(quotes)) throw new Error("Quotes must be an array.");
  return quotes.filter(q => isEligibleQuote(q, exclusions, options));
}
module.exports = { normalizeBook, isEligibleQuote, eligibleQuotes };
