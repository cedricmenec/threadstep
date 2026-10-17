# Tasks

## 1. Pure authentication core

- [x] 1.1 In a new pure `site/authentication.js` module, implement `signInMethods()` returning only the native email OTP method and `authMessage(kind)` returning fixed French messages for sign-in, invalid code, expired code, session expired, offline first use, origin refusal, permission refusal and generic failure; verify with deterministic Node tests that the method inventory contains only email OTP and that no message contains an actual OTP value, token value, key content or raw provider payload.
- [x] 1.2 Implement `deriveAuthState(user, { online, hadSession })` and `canStartAuthentication(state, online)` deriving authenticated, signed-out, expired, offline-required and refused states from the native user record and connectivity; verify with deterministic Node tests that a valid session is authenticated, an expired credential or license is expired, no session with `online: false` is offline-required, and every non-authenticated state refuses business access.
- [x] 1.3 Implement `classifyAuthFailure(error)` and `classifyPermissionFailure(error)` for invalid code, expired code, network failure, origin refusal, permission refusal and generic failure using native error codes only; verify with deterministic Node tests for each native shape (including `INVALID_OTP`, expired token, `network_error`, `PolicyRejectionError`/403) that the classification is correct and that no raw provider message is rendered.
- [x] 1.4 Implement the deterministic mapping from a native `userInteraction` payload to a view model for email entry, OTP entry and alerts, including submit and cancel outcomes; verify with deterministic Node tests using fixture payloads that email and OTP fields are exposed, that alerts carry the mapped message, and that submit/cancel invoke the native callbacks exactly once.
- [x] 1.5 Add `site/authentication.js` to the `package.json` `check` script with `node --check`; verify with a deterministic assertion that the module is covered and that `node --check site/authentication.js` exits successfully.

## 2. Native Cloud adapter, sign-in surface and authenticated gate

- [x] 2.1 Implement the `site/app.js` native adapter that starts the forced OTP native grant with `db.cloud.login({ grant_type: "otp" })`, subscribes to `db.cloud.currentUser` and `db.cloud.userInteraction`, and forwards email/OTP submissions to the native interaction callbacks; verify with static assertions that the forced OTP native login and subscriptions are present, that no provider chooser or alternative login is introduced, and that no `fetchTokens` override, custom token endpoint, `fetch(` call or application backend is introduced in the authentication path.
- [x] 2.2 Add an accessible sign-in region in `site/index.html`/`site/styles.css` driven by the view model: email entry, OTP entry, resend, status and alert messages, with text labels and live-region attributes, and correct the privacy copy that currently claims no account and no server; verify with deterministic static assertions that only email and OTP controls are declared, that no password/OAuth/social/passkey/custom-login control exists, that resend and error regions are present and that the obsolete no-account/no-server claim is gone.
- [x] 2.3 Gate `load()`, change subscriptions, business commits, the migration offer and the business UI behind the authenticated state; verify with deterministic adapter tests and static assertions that a signed-out, expired, offline-required or refused state performs no business read, write or migration and that `requireAuth: true` is still configured before any access.
- [x] 2.4 Reuse a valid existing session without calling the native OTP login, treat the transient loading user value as not signed-out, and persist only the non-secret `threadstep.auth.seen.v1` flag after a successful authentication to choose the reauthentication wording; verify with deterministic Node tests that a valid session makes no login call, that a loading-to-valid transition makes no login call, that a reload keeps the authenticated state, and that an expired session shows the reauthentication message without deleting data.
- [x] 2.5 Render the OTP resend action and retry flow through the forced native OTP grant, reusing the entered email when available; verify with deterministic adapter tests that an invalid/expired outcome keeps the sign-in surface open, that requesting a new code invokes the forced native login again, that a valid retry authenticates, and that no data record is deleted between attempts.
- [x] 2.6 Ensure the offline first-use path starts no native OTP exchange, shows the connection-required message and performs no business access; verify with deterministic adapter tests using an offline fake and with static assertions that connectivity never creates a session and never bypasses the authenticated gate.

## 3. Permission, identity and origin refusals

- [x] 3.1 Ensure the application never writes, overrides or fabricates native `owner`/`realmId` and never adds a client authorization fallback; verify with deterministic static assertions that the authentication and business paths contain no owner/realm assignment and no fallback access grant.
- [x] 3.2 Surface a native permission refusal without retrying with another identity or privileged credential and without deleting local data; verify with deterministic adapter tests that the refusal message is shown, no business operation follows, the fake store is unchanged and no alternate credential is used.
- [x] 3.3 Surface an origin/identity refusal from the native service with the mapped message and no fabricated session; verify with deterministic adapter tests that an unauthenticated-remains state is produced, business operations stay blocked and local records are preserved.

## 4. Documentation and secret-free delivery

- [x] 4.1 Update `docs/product/developer-guide.md` and `docs/product/mvp.md` to describe the native email OTP journey, the authenticated gate, session reuse/expiry, offline first-use refusal and the operator-only GitHub Pages origin allowlist procedure; verify with deterministic assertions that the new text is present, that no imposed instance URL or secret value is added and that `npm run backlog:check` passes.
- [x] 4.2 Add deterministic security assertions over `site/authentication.js`, `site/app.js`, `site/index.html`, the delivered `site/` files and the public documentation that no actual OTP value, session token value, CLI key content, privileged credential value, `fetchTokens` override, custom token endpoint or imposed instance URL is present or logged.

## 5. Integration checks

- [x] 5.1 Run `npm run check`; report the exact command and its real output, and do not mark earlier tasks complete if it fails.
- [x] 5.2 Run `openspec validate ts-027 --strict --no-interactive` and `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-027/tasks.md`; report the exact commands and their real output, and do not mark earlier tasks complete if either fails.

## Manual acceptance

- On an isolated test Dexie Cloud base with the GitHub Pages origin allowlisted by the operator beforehand, sign in on a real desktop browser with a real email address, confirm receipt of the OTP and successful session establishment, then repeat on a real phone; verify the visible sign-in choices are limited to email and OTP.
- Submit an invalid and then an expired OTP, request a new code, retry successfully and confirm the understandable messages, the absence of any data deletion and the preserved V1 document and business records.
- Reload and reopen the app on both devices with a valid session and confirm no unnecessary OTP is requested; then let the session expire and confirm the reauthentication message and successful recovery without data loss.
- Open the app offline without a prior session and confirm the connection-required message, the absence of a fabricated session, no business access and no data deletion.
- With two test identities on the isolated base, confirm each identity cannot read or modify the other's data, that permission and origin refusals are displayed without a fallback, and that the application does not grant access after refusal.
- Inspect the sign-in and diagnostic surfaces in the browser, plus browser console and network logs, and confirm no OTP, session token, CLI key or privileged credential is displayed, logged or exported; confirm the operator origin allowlist was configured outside the build.
- Navigate the sign-in journey with the keyboard alone, check focus, live-region announcements and touch targets on the phone, and check screen-reader output where possible.
- These are pending human acceptance, not completed by any green Node test, and contain no checkbox.

## Post-sync review

- After the separate OPSX semantic sync step, compare the canonical delta for `email-otp-authentication` (ADDED) against the intended behavior and confirm that no other requirement changed.
- Check the archived OpenSpec change and its versioned content.
- After the PR is published, verify the independent GitHub `check` job on the exact head SHA, the required branch protection, the merge evidence and the post-merge CI / GitHub Pages deployment.
- Verify separately, with operator evidence on the isolated Cloud base, that the Pages origin allowlist and the chosen native owner/realm configuration match what the manual acceptance exercised.
- This stage is external to `apply`; these reviews contain no checkbox and must never be marked complete before their evidence exists.
