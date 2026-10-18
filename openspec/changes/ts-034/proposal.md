# Proposal

## Why

After OTP sign-in, ThreadStep can show a generic “Dexie Cloud n'est pas
connecté” while the native synchronization is actually connecting, pulling,
offline, in error or waiting for its first remote read. Users cannot tell what
failed, whether local writes were saved, or whether a retry is safe, and an
unproven remote state can be mistaken for an empty Cloud database. TS-034 makes
the native state observable, classifies failures without leaking secrets, and
offers an explicit, native, read-only retry of the initial pull.

## What Changes

- Add a read-only synchronization diagnostic that exposes, from native Dexie
  Cloud signals: session state, transport connection, native phase, initial
  pull completion, the configured base (normalized URL and remote database
  identifier) and the status of local writes.
- Keep distinct `connecting`, `disconnected`, `offline`, `error`, `pulling`,
  `pushing`, `in-sync` and `indeterminate`. A transient native state is never
  promoted to a permanent error, and an unknown remote state is never reported
  as an empty Cloud database.
- Classify technical errors into safe categories (network/offline, permission,
  origin refusal, expired session, synchronization, local storage/read,
  uncategorized) using stable codes and fixed French messages. No OTP, token,
  email, note, title or raw error message is rendered or logged.
- Distinguish local write evidence from synchronization evidence: `local`
  (committed to IndexedDB), `pending` (native phase not yet confirmed),
  `synced` (native proof after the write) and `error`, without conflating them.
- Add a controlled native retry of the initial pull using
  `db.cloud.sync({ purpose: "pull", wait: true })`. Retry requires a configured
  base, an authenticated session and network availability; it performs no
  product mutation, no login, no import and no forced connection, and it is
  disabled while already in progress or permanently refused.
- Observe `currentUser`, `syncState` and `persistedSyncState` so the diagnostic
  updates on session, URL/base, initial-pull and phase changes, including after
  a reload or a resumed session.
- Expose a mobile-accessible panel with a labelled read-only status list, an
  `aria-live` message and a retry action with a 44 px touch target. When Cloud
  is not configured, the panel says so without constructing or contacting a
  synchronized instance.
- Reuse the existing initial-sync attestation so a blocked migration is
  explained by the diagnostic and never interpreted as an empty remote base.

## Capabilities

### New Capabilities

None. The diagnostic and retry behavior belongs to capabilities that already
own synchronization diagnostics and operational safety.

### Modified Capabilities

- `cloud-sync-lifecycle`: the existing “Truthful diagnostic and native retry”
  requirement is expanded into observable, redacted diagnostics with explicit
  native status/phase mapping, initial-pull evidence, local-write status and a
  controlled native pull retry. The existing synchronization, write, conflict
  and retry guarantees remain.
- `workspace-identity-isolation`: the “Operational safety and diagnostics”
  requirement is expanded so the diagnostic identifies the normalized URL,
  configured remote base and session category, observes URL/session changes and
  never exports email, OTP, token, note, title or raw error content.

## Impact

- `site/`: a new pure, injectable diagnostics module (native-state
  normalization, error classification, redaction, local-write reducer, retry
  preconditions and view model) and read-only panel wiring in `app.js` with
  native observable subscriptions. Existing `dexie-foundation.js`,
  `authentication.js`, `synced-records.js` and `migration-reconciliation.js`
  contracts are reused, not replaced.
- `site/index.html` and `site/styles.css`: an accessible diagnostic section and
  responsive/touch styles.
- `tests/`: deterministic Node tests over injected native states, phases,
  sessions, URLs, errors, read failures, migration blocking, retry outcomes and
  local-write status, plus static assertions on redaction and accessible
  wiring.
- `package.json`: extend the `check` syntax coverage to the new module. No new
  runtime dependency, no secret, no workflow, no protected ASF file and no
  backlog change.

## Non-goals

- A reconciliation engine, JSON import changes, or replacing the native Dexie
  Cloud protocol.
- Simulating `connected`, forcing an import, forcing a login or turning the
  diagnostic into a product mutation surface.
- Logging or exporting business content, identity emails or secrets.
- Proving a real first remote read, Chrome mobile behavior, touch, keyboard or
  screen-reader output from Node tests alone.
- Changing instance identifiers, workflows, secrets or the ASF factory.

## Uncertainties (no product decision invented)

1. **Exact native signal semantics.** The bundled `dexie-cloud-addon@4.4.15`
   exposes `syncState` (`status`, `phase`, `error`, `progress`),
   `persistedSyncState` (`initiallySynced`, `remoteDbId`, `serverRevision`,
   `realms`, `timestamp`, `error`) and `currentUser`. Which combination proves
   a completed initial pull must be confirmed on the isolated Cloud instance;
   missing or contradictory signals fail closed as `indeterminate`.
2. **Retry scope.** `db.cloud.sync({ purpose: "pull", wait: true })` is the
   documented native pull. Whether it is meaningful in every
   `disconnected`/`error` state is not proven; the design allows retry only
   when the base is configured, the session is authenticated, the device is
   online and no pull/push is already active, and otherwise explains why the
   action is unavailable.
3. **Identity disclosure.** The task forbids exposing email and secrets. An
   opaque `userId` is not explicitly forbidden, but it can be personal data.
   The proposal displays only a session category and never the email or raw
   `userId`; if operators later require a stable account reference, a
   non-reversible short fingerprint must be specified separately.
4. **Base identifier.** The normalized Cloud URL is displayed. `remoteDbId` is
   displayed only when present in persisted native state; its format is not
   assumed.
5. **Local-write correlation.** Native `syncComplete` does not prove which
   writes were propagated. The diagnostic may claim `synced` only when a
   healthy `in-sync` state and completed initial sync are observed after a
   local commit; otherwise it stays `local`/`pending`/`indeterminate`.
