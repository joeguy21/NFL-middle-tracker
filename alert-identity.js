"use strict";

// Deterministic alert identity supports idempotent persistence by the sender.
// Caller must persist keys with a uniqueness constraint before pushing.
function alertKey({ userId, ticketId, gameId, kind, milestone = null, opportunitySignature = null }) {
  for (const [name, value] of Object.entries({ userId, ticketId, gameId, kind })) {
    if (value == null || String(value).trim() === "") throw new Error(name + " is required");
  }
  if (!["middle", "hedge"].includes(kind)) throw new Error("kind must be middle or hedge");
  if (milestone != null && !["Q1", "Q2", "Q3"].includes(milestone)) throw new Error("invalid quarter milestone");
  // Middle opportunities can change within a period, so their identity includes
  // the market signature. Milestone hedge alerts are one per quarter/ticket.
  const keyParts = [String(userId), String(ticketId), String(gameId), kind, milestone || "live"];
  if (kind === "middle") {
    if (!opportunitySignature) throw new Error("middle opportunity signature is required");
    keyParts.push(String(opportunitySignature));
  }
  return keyParts.map(x => encodeURIComponent(x)).join(":");
}

function shouldNotify({ kind, width, milestone, priorKeyExists = false, gameMuted = false }) {
  if (priorKeyExists || gameMuted) return false;
  if (kind === "middle") return Number.isFinite(Number(width)) && Number(width) > 3;
  if (kind === "hedge") return ["Q1", "Q2", "Q3"].includes(milestone);
  return false;
}

module.exports = { alertKey, shouldNotify };
