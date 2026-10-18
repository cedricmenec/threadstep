# Design

## Context

See `proposal.md` — Why. The applied code on `main`:

- `site/dexie-foundation.js` validates the Cloud URL, builds the synchronized
  schema and configures `requireAuth` with a custom login GUI. It also builds
  the autonomous local database without the Cloud addon.
- `site/authentication.js` derives `loading/authenticated/signed-out/expired/
  offline-required/refused` from `db.cloud.currentUser` and classifies
  permission and origin failures.
- `site/app.js` opens the synchronized database, subscribes to `currentUser`,
  `userInteraction`, `syncComplete`, and already reads `syncState` and
  `persistedSyncState` through `nativeAttestationInput()` for migration.
- `site/migration-reconciliation.js` exposes `evaluateSyncAttestation` and
  `describeAttestationReason`, which already fail closed and explain why a
  remote base is not considered empty.
- `site/synced-records.js` is a fail-closed read boundary.
- The bundled `dexie-cloud-addon@4.4.15` exposes `db.cloud.sync({ wait, purpose
  })`, where `purpose: "pull"` triggers the native pull and `wait: true`
  resolves after a persisted-state update. Native `syncState` carries `phase`,
  `status`, `error` and `progress`; `persistedSyncState` carries
  `initiallySynced`, `remoteDbId`, `serverRevision`, `realms`, `timestamp` and
  `error`; `currentUser` is a BehaviorSubject.

Constraints: no production code may be modified during planning; the runner has
no IndexedDB, DOM, Cloud session or network, so the decisive behavior must be a
pure module with injected observables/adapters. A real first remote pull, Chrome
mobile, touch, keyboard and screen-reader behavior remain manual acceptance.

## Goals / Non-Goals

**Goals:**

- One pure, injectable diagnostic model that maps every native status/phase and
  separates session, connection, phase, initial pull, configured base, errors,
  local writes and remote-read evidence.
- Deterministic redaction: stable error categories and fixed messages, never raw
  error strings, emails, OTPs, tokens, titles or notes.
- A controlled retry contract that only calls the native pull and never mutates
  product data, logs in or imports.
- Observable updates from `currentUser`, `syncState` and `persistedSyncState`
  on session, URL/base and resume changes.
- An accessible read-only panel, testable at the view-model and static-wiring
  level.

**Non-Goals:**

- Replacing Dexie Cloud synchronization, inventing native signals or forcing a
  connection.
- Reading records as part of diagnostics. The diagnostic is read-only and does
  not itself prove a remote dataset.
- Changing the reconciliation planner, JSON import, local workspace or auth
  flows.
- Adding a browser test runner or a new runtime dependency.

## Decisions

### 1. A pure diagnostics module plus thin observable adapters

Add `site/sync-diagnostics.js` (name fixed for this change) with:

- enumerations for `SESSION_STATE`, `CONNECTION_STATE`, `SYNC_PHASE`,
  `INITIAL_PULL`, `LOCAL_WRITE_STATE`, `REMOTE_EVIDENCE` and
  `DIAGNOSTIC_ERROR`;
- `normalizeSyncState(native)` and `normalizeUser(native)`;
- `classifySyncError(value)` returning a safe category plus a whitelisted code;
- `reduceLocalWriteStatus(previous, event)`;
- `buildSyncDiagnostic(input)`;
- `canRetryInitialPull(diagnostic)`;
- `retryInitialPull(adapter, options)` where the adapter must expose
  `syncPull()`;
- `buildDiagnosticView(diagnostic)`;
- `createSyncDiagnosticsController({ readInput, syncPull, onChange })` for
  subscription and retry orchestration.

`app.js` keeps only DOM rendering, observable subscriptions and the native
adapter. Alternatives rejected: computing state in `app.js` (not runner
testable) and adding `fake-indexeddb`/jsdom (new dependency, not needed for the
decision layer).

### 2. Orthogonal state dimensions, never a single "Cloud" flag

`buildSyncDiagnostic` receives `{ configured, databaseUrl, online, user,
syncState, persistedSyncState, localWrites, readError }` and returns independent
fields:

- `session`: `authenticated`, `loading`, `signed-out`, `expired`, `refused`,
  `indeterminate`; derived from native `isLoggedIn`, loading flag, credential
  expiry and the existing auth refusal categories. No email or `userId` is
  emitted.
- `connection`: `connected`, `connecting`, `disconnected`, `offline`, `error`,
  `indeterminate`, `not-configured`; mapping `not-started`/`connecting` to
  `connecting`, `connected` to `connected`, `disconnected` to `disconnected`,
  `error` to `error`, `offline` to `offline`, and anything unknown to
  `indeterminate`.
- `phase`: `initial`, `not-in-sync`, `pulling`, `pushing`, `in-sync`, `error`,
  `offline`, `indeterminate`; only `in-sync` means synchronized, and only when
  the connection and initial pull are also healthy.
- `initialPull`: `not-configured`, `pending`, `in-progress`, `complete`,
  `failed`, `indeterminate`. `complete` requires
  `persistedSyncState.initiallySynced === true` and a non-null
  `serverRevision`; `failed` uses `persistedSyncState.error` or a sync error;
  `pulling` with incomplete persisted state is `in-progress`.
- `base`: `{ configured, url, remoteDbId, mismatch }`. `mismatch` is true when
  persisted `databaseUrl` exists and differs from the configured URL, or when a
  supplied `remoteDbId` differs from the persisted one.
- `errors`: deduplicated safe categories with fixed messages.
- `localWrites`: `not-applicable`, `none`, `local`, `pending`, `synced`,
  `error`, `indeterminate`.
- `remoteEvidence`: `not-configured`, `unknown`, `blocked`, `available`. It is
  `blocked` when `evaluateSyncAttestation` fails, with the safe
  `describeAttestationReason` text and a guarantee that Cloud is not considered
  empty. Diagnostics never read records, so `available` means only that a
  healthy attested state exists.

A transient state never becomes a permanent error: `connecting`, `pulling` and
`pushing` are not added to `errors`. `offline` and `disconnected` are distinct
transport categories. `indeterminate` is reserved for missing or contradictory
signals.

### 3. Redaction by allowlist

`classifySyncError` inspects only `name`, `code`, `messageCode`, `httpStatus`,
`status` and `license.status`. It returns one of `network`, `offline`,
`permission`, `origin`, `session`, `sync`, `storage`, `read`, `uncategorized`
and a code from a fixed whitelist (otherwise `null`). The view uses fixed French
messages per category; it never interpolates `error.message`, `error.stack`,
email, OTP, token or business content.

`buildDiagnosticView` emits only: session label, connection label, phase label,
initial-pull label, normalized URL, optional `remoteDbId`, error category
labels, local-write label, remote-evidence label and retry availability. Static
tests scan the module and app wiring for forbidden fields and for
`innerHTML`/`console` patterns.

### 4. Local-write reducer with explicit evidence

`reduceLocalWriteStatus(previous, event)` handles:

- `commit-local`: previous becomes `local`, never `synced`;
- `commit-error`: `error`, while a later sync error must not erase local
  success evidence;
- `sync-state`: `pulling`/`pushing` after a local write becomes `pending`; a
  healthy `in-sync` with completed initial sync becomes `synced`;
- `read-error`: `error` when local records cannot be read;
- `reset`: `none`.

`local` and `pending` are never rendered as `synced`. `synced` requires native
`in-sync` plus `initiallySynced` after a local write; otherwise it stays
`indeterminate`.

### 5. Controlled native retry

`canRetryInitialPull(diagnostic)` returns `{ allowed, reason }`. Allowed only
when: the base is configured, session is `authenticated`, device is online,
there is no URL/session mismatch, initial pull is not `complete`, phase is not
`pulling`/`pushing`, and no permission/origin refusal exists. Otherwise it
returns a typed reason (`not-configured`, `unauthenticated`, `offline`,
`already-synced`, `in-progress`, `refused`, `indeterminate`).

`retryInitialPull(adapter, { isAllowed, onState })`:

1. re-evaluates the predicate against the latest diagnostic;
2. if not allowed, returns `{ status: "blocked", reason }` without calling the
   adapter;
3. otherwise calls `adapter.syncPull()` once, which in the browser is
   `db.cloud.sync({ purpose: "pull", wait: true })`;
4. returns `{ status: "completed" }` or `{ status: "failed", error }` where the
   error is the safe classification, never a raw message;
5. re-renders from the latest observables. A failure keeps `initialPull` as
   `failed` or `indeterminate`; it never sets `remoteEvidence` to `available`,
   never treats the base as empty, and never triggers an import, login or
   product write.

A controller-level `busy` flag prevents concurrent duplicate retries.

### 6. Observable wiring and URL/session changes

`app.js` subscribes to `db.cloud.syncState`, `db.cloud.persistedSyncState` and
`db.cloud.currentUser` (in addition to the existing auth subscriptions), and
re-renders the diagnostic on each emission. The base URL is read through
`readCloudConfig()` on each render, so saving a new URL and rebuilding the
synchronized database updates the panel. A reload restores the persisted native
session and initial-sync state; the diagnostic shows `complete` and disables
retry when already synchronized. The existing `syncComplete` subscription also
refreshes the diagnostic.

In autonomous local mode the panel is rendered without constructing a
synchronized database: it shows “Synchronisation Cloud non activée”, no base, no
session and no retry, and performs no network call.

### 7. Accessible, read-only panel

`app.js` renders a `<section id="sync-diagnostic">` with:

- a heading and a short explanation that the view is read-only;
- a `<dl>` of term/description rows, built with `createElement`/`textContent`;
- an errors `<ul>` with one item per safe category;
- a retry `<button type="button">` with a visible label, a `disabled` state
  derived from `canRetryInitialPull`, and an accessible reason rendered next to
  it;
- an `aria-live="polite"` `role="status"` paragraph for retry progress and
  outcome;
- 44 px minimum touch targets and no focus trap; the button is keyboard
  operable and the status is announced on change.

No `innerHTML`, template HTML or user string interpreted as markup. The
diagnostic owns no mutation control other than retry; no logout, purge, import
or migration action is added.

### 8. Deterministic tests before sync

`tests/sync-diagnostics.test.mjs` covers:

- every native `status` and `phase`, including unknown values;
- session categories and refusal categories;
- initial pull pending/in-progress/complete/failed/indeterminate;
- local-write transitions and non-conflation of `local`/`pending`/`synced`;
- URL, remote database and session changes and mismatch;
- read errors;
- blocked migration via `evaluateSyncAttestation` and the “not empty” guarantee;
- retry preconditions, blocked reasons, one adapter call, success and failure
  without empty-base conclusions;
- redaction: emails, OTPs, tokens, titles and notes from inputs never appear in
  the view or serialized diagnostic;
- view-model labels for all categories and mobile-accessible wiring asserted
  statically from `app.js`/`index.html`.

## Risks / Trade-offs

- **Native signal shape differs from the bundled assumptions** → normalize
  defensively and fail closed as `indeterminate`; confirm on an isolated Cloud
  instance.
- **`sync({ purpose: "pull" })` may not resolve in some transport states** →
  retry is disabled while pulling/pushing and bounded by the precondition;
  failures are reported safely, never as empty Cloud.
- **`syncComplete` does not identify which writes propagated** → only claim
  `synced` from healthy native in-sync plus completed initial sync after a local
  commit; otherwise keep `pending`/`indeterminate`.
- **Diagnostic could leak PII** → allowlist projection, fixed messages, static
  redaction tests, no raw `error.message`.
- **Extra subscriptions could disturb auth behavior** → use read-only native
  BehaviorSubject subscriptions; the existing auth controller remains the sole
  owner of login state.
- **Runner cannot prove browser/mobile/search-reader behavior** → deterministic
  tests cover decision logic; the manual Cloud/browser acceptance remains
  mandatory.

## Migration Plan

1. Add the pure diagnostics module and its tests; register the module in
   `package.json` `check`.
2. Wire the observables, local-write events and retry adapter in `app.js`.
3. Add the diagnostic section and styles.
4. Update product/factory-facing documentation that describes diagnostics
   (without touching protected ASF files).
5. Run `npm run check` and strict OpenSpec validation before sync.
6. No data migration, server change or secret change. Rollback is reverting the
   code; existing local and Cloud records are untouched by diagnostics.

## Open Questions

- The exact retry affordance in a `disconnected` transport state should be
  confirmed on the isolated Cloud instance; until then retry remains available
  whenever the predicate allows it and the native pull reports its own result.
- Whether operators need an opaque, non-reversible account reference in the
  diagnostic is deferred; the current design displays only a session category
  and never an email or raw user identifier.
