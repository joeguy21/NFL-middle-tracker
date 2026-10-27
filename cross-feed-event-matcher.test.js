const assert = require("node:assert/strict");
const { matchCrossFeedEvent, eventSignature } = require("./cross-feed-event-matcher");
const target = {
  league: "nfl", homeTeam: "Green Bay Packers", awayTeam: "Carolina Panthers",
  startTime: "2026-10-30T00:16:00Z", eventId: "feed-a-123"
};
const reverseOrder = {
  league: "NFL", homeTeam: "Carolina Panthers", awayTeam: "Green Bay Packers",
  startTime: "2026-10-30T00:20:00Z", eventId: "feed-b-999"
};
assert.equal(matchCrossFeedEvent(target, [reverseOrder]), reverseOrder, "Team order and provider IDs may differ");
assert.equal(matchCrossFeedEvent(target, [{...reverseOrder, awayTeam:"Chicago Bears"}]), null, "Different teams cannot match");
assert.equal(matchCrossFeedEvent(target, [{...reverseOrder, startTime:"2026-10-30T02:00:00Z"}]), null, "Kickoff outside tolerance cannot match");
assert.equal(matchCrossFeedEvent(target, [{...reverseOrder, league:"nba"}]), null, "Different leagues cannot match");
assert.equal(matchCrossFeedEvent(target, [reverseOrder, {...reverseOrder,eventId:"another-id"}]), null, "Ambiguous matches fail closed");
assert.equal(matchCrossFeedEvent({...target, startTime:"not-a-date"}, [reverseOrder]), null, "Invalid target kickoff fails closed");
assert.equal(eventSignature({league:"nfl",homeTeam:"A",awayTeam:"B",startTime:"2026-10-30T00:00:00Z"}).teams.length, 2);
console.log("cross-feed event matcher tests passed");

const aliasMatch = matchCrossFeedEvent(target, [{
  league:"nfl", homeTeam:"CAR", awayTeam:"GB",
  startTime:"2026-10-30T00:20:00Z", eventId:"other-provider"
}]);
assert.ok(aliasMatch, "Reviewed team abbreviations can match canonical team names");
assert.equal(matchCrossFeedEvent(target, [{
  league:"nfl", homeTeam:"NY", awayTeam:"GB",
  startTime:"2026-10-30T00:20:00Z"
}]), null, "Unreviewed ambiguous shorthand must not match");
