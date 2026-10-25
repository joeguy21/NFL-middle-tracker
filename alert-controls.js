"use strict";
// Client-side helpers for the authenticated per-account game mute endpoints.
// Game identifiers must be the canonical event ID shared by alert candidates.
async function muteGame(accountRequest, gameId) {
  if (typeof gameId !== "string" || !gameId.trim()) throw new Error("A game ID is required");
  return accountRequest("/api/my-notifications/mute-game", {
    method: "POST", body: JSON.stringify({ gameId: gameId.trim() })
  });
}
async function unmuteGame(accountRequest, gameId) {
  if (typeof gameId !== "string" || !gameId.trim()) throw new Error("A game ID is required");
  return accountRequest("/api/my-notifications/mute-game?gameId=" + encodeURIComponent(gameId.trim()), { method: "DELETE" });
}
async function getMutedGames(accountRequest) {
  const data = await accountRequest("/api/my-notifications/muted-games");
  return Array.isArray(data.mutedGames) ? data.mutedGames : [];
}
module.exports = { muteGame, unmuteGame, getMutedGames };
