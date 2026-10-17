# Proposal

## Why

ThreadStep can configure a Dexie Cloud instance (TS-024), persist business
records transactionally (TS-025) and convert the historical V1 document with
explicit consent (TS-026), but a configured base still has no sign-in journey.
With `requireAuth: true`, users cannot establish or restore a session, so the
application cannot safely expose synchronized data, and the product requires
email OTP as the only authentication method.

## What Changes

- Add an exclusive **email + OTP** sign-in journey built on the native Dexie
  Cloud authentication flow (`requireAuth: true`), with email entry, code
  request, code verification, resend after failure and an authenticated
  session. No OAuth, password, social provider, passkey or custom login is
  offered, even when the Cloud service exposes other providers.
- Gate business access on a valid authenticated session: a configured base
  without a valid session shows the sign-in journey and runs no business
  operation; a valid existing session is reused without asking for a new code.
- Handle invalid or expired OTP, session expiry, retries and an absent initial
  offline session with understandable messages. Authentication failures never
  simulate success, never bypass `requireAuth: true` and never purge the
  historical V1 document or the local business records.
- Rely on Dexie Cloud's native identity, origin, `owner`/`realm` and permission
  enforcement. The application MUST NOT implement its own authorization, grant
  access after a refusal or let one authenticated identity read or modify
  another identity's data. The GitHub Pages origin is allowlisted in the
  Dexie Cloud service by a documented operator procedure outside the build.
- Keep authentication direct between the browser and Dexie Cloud: no
  application backend, no custom token endpoint, no `fetchTokens` override and
  no machine credential in the client.
- Ensure no OTP, session token, CLI key or privileged credential appears in the
  diagnostic DOM, application logs, public documentation or delivered bundle.
- Add deterministic Node tests for the pure authentication state, messages and
  refusal logic plus static assertions over the wiring and delivered sources.
  Real email delivery, real-device behavior, browser storage and Cloud
  permissions remain manual acceptance.

## Capabilities

### New Capabilities

- `email-otp-authentication`: exclusive native Dexie Cloud email OTP sign-in,
  authenticated session reuse and expiry, invalid/expired code retry, offline
  first-authentication refusal, native permission/origin refusal handling and
  the absence of authentication secrets or a custom token backend.

### Modified Capabilities

- None. `dexie-cloud-configuration` already requires `requireAuth: true` and no
  alternative sign-in option, and `frontend-security-boundary` already forbids
  machine secrets. TS-027 adds the observable authentication journey and its
  refusal behavior without changing those existing requirements.

## Impact

- `site/`: new pure authentication module (state, exclusive method list, error
  messages, offline gate and refusal mapping) plus the native Dexie Cloud
  adapter, sign-in surface and authenticated gating in `app.js`; `index.html`
  and `styles.css` gain the accessible sign-in region. `core.js` stays pure.
- `site/vendor/dexie-cloud.mjs` is unchanged: the addon already exposes
  `db.cloud.login`, `db.cloud.currentUser` and the `userInteraction` contract.
  No new dependency is required.
- `package.json`: extend `node --check` coverage to the new module.
- `tests/`: new deterministic Node tests over the injected authentication
  adapter and static source assertions; no fake IndexedDB or DOM runner.
- `docs/product/developer-guide.md` and `docs/product/mvp.md`: describe the
  delivered OTP journey, the authenticated gate and the operator origin
  allowlist procedure. No secrets or instance URL are recorded.
- No protected factory file, workflow, backlog, product specification or
  canonical OpenSpec spec is edited by this change.

## Non-goals

- Logout, local purge and changing the Dexie Cloud URL (TS-029).
- The global synchronization indicator and the technical diagnostic view
  (TS-028), beyond ensuring authentication never exposes secrets in those
  surfaces.
- Converting historical V1 data (TS-026, delivered), rebuilding the
  persistence model (TS-025, delivered) or consolidating the full guarantee
  suite (TS-030).
- Adding OAuth, password, passkey, social providers, team administration or a
  token backend.
- Executing the Dexie Cloud operator allowlist or realm configuration from the
  build. That is a separate service-side procedure on an isolated test base.

## Uncertainties (no product decision invented)

1. **Realm/owner semantics.** The task requires native permissions and no
   cross-user access, but does not decide whether ThreadStep needs a shared
   realm or only per-user ownership. The change relies on Dexie Cloud defaults
   and never invents or overrides `owner`/`realmId`; the service-side
   configuration remains an operator decision.
2. **Expired-session signal.** Dexie Cloud may expose expiry through the
   authenticated user record, a token/license status or a generic
   unauthorized transition. The spec requires a reauthentication message and
   no data loss, but the exact native signal to distinguish "expired" from
   "never authenticated" must be confirmed against the service during apply.
3. **Resend and rate limits.** The requirement is that a user can request a new
   code and retry after an invalid/expired one. Any resend throttling or retry
   count is left to the native Dexie Cloud behavior; no client limit is fixed.
4. **Sign-in surface form.** The task allows the native GUI or the native
   `userInteraction` contract. This proposal requires an accessible, testable
   journey but does not fix its visual presentation beyond showing only email
   and OTP.
5. **Real email delivery and Cloud setup.** A real OTP, an isolated Cloud base
   and an authorized Pages origin are manual/operator prerequisites, not
   runner-provable. No production base or paid provider is used by this plan.
