# Design

## Context

See `proposal.md` — Why. `site/app.js` configures a Dexie Cloud database with
`requireAuth: true` and exposes the business UI immediately; there is no
sign-in journey, no session state and no authenticated gate. `site/persistence.js`
and `site/migration.js` keep local records and the historical V1 document but
never delete them. `site/vendor/dexie-cloud.mjs` (dexie-cloud-addon 4.4.15)
exposes `db.cloud.login`, `db.cloud.currentUser`, `db.cloud.syncState` and the
`db.cloud.userInteraction` observable; it does not export a mountable native GUI
component. Tests are deterministic Node tests over pure modules plus static
assertions; there is no DOM, IndexedDB or real-network runner. Protected factory
paths, product specifications and `AGENTS.md` must not change, and every
checkbox must be provable on the runner before OPSX sync.

## Goals / Non-Goals

**Goals:**

- A pure, deterministic authentication core: exclusive method inventory,
  session/expiry derivation, offline gate, native refusal classification and
  safe messages.
- A thin `app.js` adapter that drives the native Dexie Cloud login and
  `userInteraction` contract without a custom token exchange or backend.
- An authenticated gate that prevents business reads, writes and historical
  migration until a valid session exists, while preserving every local record.
- Deterministic tests for valid/invalid/expired sessions and codes, offline
  first use, permission/origin refusal and secret-free surfaces.

**Non-Goals:**

- Logout and purge (TS-029), the sync indicator and diagnostic view (TS-028),
  and the consolidated guarantee suite (TS-030).
- Real email delivery, a real Cloud test base or the operator origin allowlist
  during `apply`.
- New dependencies, a React GUI, custom authorization rules or service-side
  realm/owner design.

## Decisions

### Decision: consume the native `userInteraction` contract with a forced OTP grant

Use `db.cloud.login({ grant_type: "otp" })` (and the same forced OTP grant for
a resend, reusing the entered email when available) to start the native email
OTP exchange, and subscribe to `db.cloud.userInteraction` to render accessible
email, OTP and alert dialogs in ThreadStep's existing DOM. Forcing the OTP grant
prevents the addon from discovering and offering other native providers. The
addon performs the email/OTP token exchange itself; the application supplies no
`fetchTokens` function and no token endpoint. Alternatives rejected: plain
`db.cloud.login()` (may offer other providers when the service exposes them),
bundling the addon's React GUI (not exported by the vendored bundle and would
add a build/dependency), or implementing a custom email/OTP HTTP flow
(forbidden by the task and the product spec).

### Decision: a pure `site/authentication.js` core

Keep all decisive logic in pure functions: `signInMethods()` (email OTP only),
`deriveAuthState(user, { online, hadSession })` (authenticated, expired,
signed-out, offline-required), `canStartAuthentication(state, online)`,
`classifyAuthFailure(error)` (invalid/expired code, network, origin refusal,
permission refusal, generic) and `authMessage(kind)` (French, secret-free).
`app.js` only subscribes, renders and invokes the adapter. Alternatives
rejected: logic inside `app.js` (untestable in the runner) and adding a DOM
test dependency (new dependency, ephemeral-runner risk).

### Decision: authenticated gate before any business access

On bootstrap with a valid configuration, construct/configure the Dexie Cloud
database as today, then derive the session state. Only an authenticated state
calls `load()`, subscribes to business changes, offers historical migration or
commits business operations. A signed-out, expired, offline-required or refused
state shows the sign-in/refusal surface and leaves stored data untouched. This
matches `requireAuth: true` and prevents a pre-authentication write or V1
transfer. The gate never calls `delete`, `clear`, `removeItem(STORAGE_KEY)` or a
Cloud purge.

### Decision: session reuse and expiry wording

Treat a user record as authenticated only when Dexie Cloud reports it logged in
with a usable license and no expired access/refresh credential. The transient
`isLoading` user value is not treated as signed-out: wait for the first settled
native value before showing the sign-in journey or starting a login, so a
reload does not request an unnecessary OTP. On startup, a valid session is
reused without calling `login()`. To distinguish "session expired" from "first
sign-in", persist a non-secret origin-local boolean
(`threadstep.auth.seen.v1`) after a successful authentication; it contains no
identity, token or code and is never synchronized or exported. It is only used
to choose the reauthentication message.

### Decision: offline first authentication fails closed

When `navigator.onLine === false` and no valid session exists, do not start the
native OTP exchange and show that initial authentication requires a connection.
Do not fabricate a user, bypass the gate or infer a session from connectivity.
Native network failures (`TypeError`, network error codes) also map to the same
safe message. Connectivity is only a pre-check; it is never used as proof of
authentication.

### Decision: no client-side authorization and no ownership override

`subjects`/`items` keep their native Dexie Cloud `owner`/`realmId` assignment.
The application never writes, overrides or fabricates those fields and never
adds a fallback access rule. Native `PolicyRejectionError`, 403 and permission
failures are classified and displayed; the app does not retry with another
identity, a privileged credential or a different origin. The exact realm/owner
configuration remains an operator decision.

### Decision: secret-free auth surface and messages

The authentication module has no DOM, `console`, `fetch`, `XMLHttpRequest`,
token storage or raw provider payload logging. Messages are derived from
classified kinds, not interpolated provider bodies. The sign-in/diagnostic
surface may show status, destination and non-secret identity, but never an OTP,
session token, CLI key or privileged credential.

### Decision: test strategy

Add `tests/email-otp-auth.test.mjs` with an injected fake authentication
adapter and fake clock/connectivity, covering: only email OTP is offered;
valid session reuse with no login call; expired session reauthentication and
data preservation; invalid/expired OTP refusal, resend and successful retry;
offline first-use failure; permission/origin refusal without fallback or
deletion; and safe message classification. Add static assertions over
`site/authentication.js`, `site/app.js`, `site/index.html` and the docs for the
native adapter, the authenticated gate, no `fetchTokens`, no backend/token
endpoint, no secret/token logging and no hardcoded instance URL. Real email,
device, keyboard, screen-reader and Cloud permission checks stay in Manual
acceptance.

## Risks / Trade-offs

- [The `userInteraction` payload shape may evolve with the addon] → keep the
  native adapter thin, test the mapping with fixtures and pin the dependency as
  today; do not copy provider internals.
- [Gating could hide local data from a user who has not authenticated] →
  preserve data untouched, document the behavior, and keep export/migration
  decisions outside this change; no deletion path is added.
- [The "expired" distinction depends on a local flag] → the flag is non-secret
  and only chooses wording; authentication still comes exclusively from Dexie
  Cloud.
- [Offline detection can be unreliable] → treat it as a pre-check only and also
  classify native network failures; never infer success from connectivity.
- [Permission behavior cannot be fully proven without a real base] → rely on
  native enforcement, assert the application never adds/overrides access, and
  keep real cross-user/origin checks in Manual acceptance.
- [Messages could leak provider details] → map to fixed kinds and never render
  raw token-bearing payloads.

## Migration Plan

The change is additive at the data level: no schema version, store, record shape
or historical V1 key changes. Existing IndexedDB data and the V1 document stay
in place; the new gate only controls when the application uses them. Rollback is
reverting the PR, which restores the previous bootstrap without deleting any
base. No operator Cloud configuration is executed by the release; the Pages
origin allowlist is documented as a separate service-side procedure.
