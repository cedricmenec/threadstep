# Tasks

## 1. Native diagnostic core

- [x] 1.1 Add `site/sync-diagnostics.js` with the diagnostic enumerations and pure normalization functions; add it to the `node --check` chain in `package.json` and verify `node --check site/sync-diagnostics.js` succeeds.
- [x] 1.2 Implement `normalizeSyncState` and `normalizeUser` so every native `syncState.status` (`not-started`, `connecting`, `connected`, `disconnected`, `error`, `offline`, unknown) and every `syncState.phase` (`initial`, `not-in-sync`, `pulling`, `pushing`, `in-sync`, `error`, `offline`, unknown) maps to a distinct safe value; verify a table-driven Node test covers all listed and unknown values.
- [x] 1.3 Implement `buildSyncDiagnostic` with independent session, connection, phase, initial-pull, base, errors, local-write and remote-evidence fields; verify tests assert that `connecting`, `pulling` and `pushing` are not classified as permanent errors and that unknown input yields `indeterminate`.
- [x] 1.4 Derive the initial-pull state only from persisted/native evidence (`initiallySynced`, `serverRevision`, `pulling`, persisted `error`); verify tests cover `not-configured`, `pending`, `in-progress`, `complete`, `failed` and `indeterminate` without treating missing data as an empty Cloud base.
- [x] 1.5 Normalize the configured base (URL and optional `remoteDbId`) and detect URL/remote-database mismatch; verify tests cover same URL, changed URL, changed `remoteDbId` and a persisted `databaseUrl` that differs from the configured URL.

## 2. Safe error classification and redaction

- [x] 2.1 Implement `classifySyncError` using only stable fields (`name`, `code`, `messageCode`, `httpStatus`, `status`, `license.status`) and a fixed category/code whitelist; verify tests cover network, offline, permission, origin, expired session, synchronization, storage, read and uncategorized errors.
- [x] 2.2 Implement the fixed French diagnostic labels and ensure no raw error message, stack or user value is interpolated; verify tests inject distinct email, OTP, token, title, note and secret strings and assert none appears in the built diagnostic or view model.
- [x] 2.3 Remove any diagnostic or retry logging of business content; verify a static test asserts the module and app wiring contain no `console` call interpolating record content, and no `innerHTML` or HTML template rendering of diagnostic values.

## 3. Initial pull, remote evidence and blocked migration

- [x] 3.1 Compute remote evidence with the existing `evaluateSyncAttestation` and `describeAttestationReason`; verify tests cover attested, offline, unauthenticated, destination-missing, sync-error, sync-offline, initial-sync-pending, session-mismatch and indeterminate reasons.
- [x] 3.2 Guarantee that pending, failed, read-error or indeterminate evidence never yields an empty-Cloud conclusion; verify tests assert the view text states that the remote base is not considered empty and that no record read, import or write occurs.
- [x] 3.3 Verify a failed remote read is represented as a distinct `read` error and preserves local-write evidence; verify a test injects a thrown reader and asserts no `available` remote evidence, no synchronization claim and no mutation call.

## 4. Truthful local write status

- [x] 4.1 Implement `reduceLocalWriteStatus` for `none`, `local`, `pending`, `synced`, `error`, `indeterminate` and `not-applicable`; verify tests assert a local commit never becomes `synced` and a read error becomes `error`.
- [x] 4.2 Implement the synchronization transitions (`pulling`/`pushing` after a local commit become `pending`; healthy `in-sync` with completed initial sync becomes `synced`; a later sync error keeps the local-write evidence while reporting the error separately); verify tests cover each transition.

## 5. Controlled native retry

- [x] 5.1 Implement `canRetryInitialPull` with typed blocked reasons (`not-configured`, `unauthenticated`, `offline`, `already-synced`, `in-progress`, `refused`, `indeterminate`) and mismatch checks; verify a table-driven test asserts the predicate for each state.
- [x] 5.2 Implement `retryInitialPull` so it calls the injected native pull adapter at most once, performs no product write, no login and no import, and returns a safe result; verify tests assert zero adapter calls for every blocked reason and exactly one call for an allowed retry.
- [x] 5.3 Verify retry success updates the diagnostic to completed initial pull and disables further automatic retry, while retry failure stays `failed`/`indeterminate`, never `available`, and never concludes an empty Cloud base; verify a controller test covers success, failure, rejection and duplicate-click prevention.
- [x] 5.4 Wire the browser retry adapter to `db.cloud.sync({ purpose: "pull", wait: true })` only; verify a static unit test asserts the exact native call and asserts there is no `login`, `import`, `put`, `add`, `delete` or business mutation in the retry path.

## 6. Observable wiring and accessible panel

- [x] 6.1 Subscribe to `db.cloud.syncState`, `db.cloud.persistedSyncState` and `db.cloud.currentUser` and re-render the diagnostic on each emission and on the existing `syncComplete`; verify a test with injected observables proves the view updates on session, phase, initial-pull and URL changes.
- [x] 6.2 Render the diagnostic section with `createElement`/`textContent` only, a `<dl>` status list, an errors `<ul>`, a labelled `type="button"` retry control, a visible blocked reason and an `aria-live="polite"` status; verify static DOM-wiring tests assert these attributes and the absence of `innerHTML`.
- [x] 6.3 Render a local-mode diagnostic that says Cloud synchronization is not activated without constructing a synchronized instance or making a network call; verify a static test asserts the local branch performs no `db.cloud` configuration or sync call.
- [x] 6.4 Add responsive styles with a 44 px minimum touch target for the retry control and visible focus styling; verify a static unit test asserts the minimum size and the focus-visible rule in `site/styles.css`.

## 7. Application integration and documentation

- [x] 7.1 Connect `local`, `pending`, `synced` and `error` events from the existing commit, commit-error, sync-state and sync-complete paths to `reduceLocalWriteStatus` without changing business write behavior; verify integration tests assert the diagnostic status follows actual commits and native transitions.
- [x] 7.2 Update `docs/product/developer-guide.md` and `docs/product/dexie-cloud-rollout.md` with the read-only diagnostic dimensions, redaction rules, local/pending/synced distinction and controlled pull retry; verify a documentation test asserts the TS-034 concepts are present and that no secret or personal example is added.
- [x] 7.3 Verify the change touches only authorized paths and adds no secret; run `git diff --name-only` and assert the list contains no `.github/`, `AGENTS.md`, `opencode.json`, workflow, credential or backlog file.

## 8. Integration verification

- [x] 8.1 Run `npm run check`; report the actual test, backlog and syntax results and do not mark this task done if any command fails.
- [x] 8.2 Run `openspec validate ts-034 --strict --no-interactive`; report the actual result and do not mark this task done if validation fails.

## Manual acceptance

These checks require a real isolated Dexie Cloud instance, a real browser and human observation. They remain **pending human acceptance** and are **not** completed by a green Node or CI run. They contain **no checkbox**.

- On an isolated Dexie Cloud test instance only, with prior JSON/V1 backup exports, use Chrome mobile and a desktop browser.
- Perform a real OTP sign-in, including an invalid/expired code, a new code, and a resumed valid session; verify the diagnostic session category without displaying email, OTP or token.
- Verify a slow connection shows connecting/pulling without a permanent error, and that a completed initial pull changes the diagnostic to completed and disables an unnecessary retry.
- Cut the network, verify offline/disconnected classification and the disabled or explained retry, then restore the network and use the retry action; verify the real first remote read and that a failure never claims an empty Cloud base.
- Exercise a permission/origin refusal and verify the diagnostic distinguishes it from a network problem and keeps retry unavailable.
- Change the Cloud URL and the account; verify the diagnostic shows the new normalized URL/session, signals a base mismatch where applicable and copies no data.
- Change a subject/step offline, verify local write status remains local/pending until native synchronization is proven, then verify the synchronized state after reconnection.
- Verify the diagnostic message and retry action on a mobile viewport: touch target, Tab/Enter/Space operation, visible focus and screen-reader announcement of the `aria-live` status.
- Verify titles and notes are never displayed in the diagnostic and that browser logs/network diagnostics contain no OTP, token, email, title or note.
- Verify a blocked migration shows the native status/phase and reason in the diagnostic and never concludes an empty remote base.

## Post-sync review

- After the separate OPSX semantic sync, compare the canonical `cloud-sync-lifecycle` and `workspace-identity-isolation` deltas with the intended ADDED and MODIFIED behavior, including preserved existing scenarios.
- Review the archived change and its versioned content; verify no protected factory file, workflow, secret, configuration, backlog entry or product history was rewritten by apply.
- After PR publication, verify the independent GitHub `check` on the exact final PR SHA, the required merge protection and the merge evidence.
- Separately verify post-merge `main` CI and the GitHub Pages deployment.
- Confirm that the real isolated-Cloud manual acceptance was actually performed and reported; a green runner does not prove Chrome mobile, touch, keyboard, screen-reader, OTP or remote synchronization behavior.
