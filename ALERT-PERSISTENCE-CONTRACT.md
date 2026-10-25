# Proposed alert persistence contract

Status: schema proposal only. Migration `001-tracked-alerts.sql` is committed to the feature branch and has **not** been applied to any database.

## Identity and ownership
- `principal_id` must come from a verified server-side authenticated session/device credential.
- Never accept a caller-supplied principal ID as authority.
- The existing shared `TRACKER_ACCESS_KEY` is a service gate, not end-user identity and must not be used as the subscription owner.
- Enforce ticket uniqueness on (principal, ticket ID); retrying the same registration should be idempotent.
- If a repeated registration uses the same identity but different accepted wager details, reject as conflict or require an explicit edit workflow. Do not silently overwrite.

## Registration invariants
1. Validate ticket schema and affirmative opt-in.
2. Resolve the event against authoritative normalized schedule data and verify both teams.
3. Confirm the submitted structured market is a full-game spread, with a signed handicap for the selected team.
4. Keep accepted line/odds/stake immutable as the reference ticket snapshot. Any correction should be explicit/audited.
5. Tracking disablement must prevent new candidates; retain history according to a documented retention policy.
6. Do not register the current moneyline-only UI ticket as a spread.

## Alert outbox invariants
- Candidate identity must be deterministic for ticket + game + alert kind + milestone/market state as defined by the evaluator.
- Unique (principal, alert identity) makes enqueue safe across repeated polling.
- A worker must claim pending rows transactionally and use bounded retry/backoff.
- A successful push send followed by a crash before marking sent can still result in duplicate device delivery. Use provider collapse/deduplication identifiers when supported; exactly-once push delivery cannot be promised.
- Dead-letter after a configured retry limit and surface health metrics.
- Include quote timestamps and suppress stale or malformed market snapshots.

## Not covered by this schema
- Authentication/session creation and revocation.
- Device token registration, ownership, and unsubscribe.
- Per-game mute/preferences.
- Worker lease strategy, scheduler, polling budgets, provider mapping validation.
- Notification provider credentials or actual push send.
- Retention/deletion policy and user data export.

## Release gate
Add migration integration tests against a disposable PostgreSQL instance; implement authorization and event resolution before exposing registration routes. Do not apply this migration to test or production DB until reviewed and explicitly approved.


## Device authentication boundary (implemented utility; not yet wired to routes)
- `device-auth.js` accepts only one syntactically valid opaque Bearer token and hashes it before asking the repository for a lookup.
- Repository contract: `findActiveDeviceByCredentialHash(hash)` must use a parameterized query joining device and principal records, excluding revoked devices and disabled principals. Return only the server-owned `deviceId` and `principalId`, or null.
- Authenticated identity is derived exclusively from that lookup. Callers must not submit an owner ID to select records.
- Authentication helper and tests are pure and isolated. This is not yet an HTTP middleware integration or a credential enrollment/revocation system.
- Do not provision users or enable endpoints until a separately authenticated, auditable enrollment process exists. No self-service principal creation based on an unauthenticated request.
