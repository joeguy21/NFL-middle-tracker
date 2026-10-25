# Alert integration readiness audit

Updated: 2026-10-25

## Verified integration blockers

1. The browser records tickets in localStorage using the `nfltracker` key. The current logger persists a timestamp-style ID and fields such as game, team, opponent, book, American odds, and stake.
2. The current form supports Moneyline only. Spread is disabled as “coming later”.
3. The pure alert candidate evaluator requires a ticket with a stable ID, resolved game ID, team, spread handicap, stake, and American odds.
4. The resolver added on the feature branch accepts explicit `gameId` plus a verified team/opponent pair, or a unique exact matchup. Unknown aliases fail closed.
5. Existing server ledger sync can store browser records in PostgreSQL, but it is a generic record mirror—not a tracked alert subscription protocol. It has no ticket ownership, push endpoint, notification preferences, or idempotent alert outbox.
6. Current data feed parser must supply normalized, labeled full-game spread outcomes. Existing UI code includes inferred home/away fallback for some moneyline prices; that logic must not be reused to produce alert-worthy spreads.

## Integration decisions required before live alerts

- Add a real accepted spread ticket flow and persist market type, handicap, book, accepted odds, stake, stable ticket ID, event ID, and team pair. A moneyline ticket must never be represented as a spread ticket.
- Resolve and register only tickets that pass schema and team checks. Store ownership/access credentials securely; do not expose tracker keys or provider secrets to the browser.
- Separate user-tracked ticket state from per-game alert preferences (enabled/muted).
- Store alert idempotency keys with a database uniqueness constraint and use a durable outbox for retries.
- Validate provider timestamp semantics and spread selection labeling before evaluating candidates.
- Create a server-side schedule/score polling worker and bounded provider odds polling with timeout, rate limits, stale-data suppression, and health metrics.
- Add authenticated push device registration, opt-out/revoke, and notification delivery retries. Browser polling alone is not background push.

## Release gates

- Unit and integration tests passing on the latest branch head.
- Tests for duplicate registrations, repeated snapshots, delayed/duplicated quarter transitions, stale quotes, line flips, ambiguous matchup, malformed outcomes, and push failure retry.
- Test environment validation against representative real feed payloads.
- User approval before any merge or production deployment.
