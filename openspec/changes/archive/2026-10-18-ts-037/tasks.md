# Tasks

## 1. Pure activation and isolation core

- [x] 1.1 Add `site/cloud-activation.js` with a pure activation state machine for `local`, `preparing`, `connecting`, `discovering`, `review`, `transfer-pending`, `active`, `failed` and pre-consent `cancelled`; verify `node --check site/cloud-activation.js` succeeds and `node --test tests/ts-037-activation.test.mjs` covers every stage transition, invalid transitions and recoverable failure.
- [x] 1.2 Add a pure target classifier over `evaluateSyncAttestation()` and the attested target read that returns `verified-empty`, `populated`, `divergent`, `unavailable` or `identity-mismatch`; verify tests prove that missing evidence, empty sync cache, read errors, offline, wrong URL/`remoteDbId` and mismatched user/realms never return `verified-empty`.
- [x] 1.3 Add the non-synchronized activation record helpers for `threadstep.cloud.activation.v1` with only version, status, URL, optional `remoteDbId`, source fingerprint and hashed user identity; verify tests cover parsing, unknown versions, unavailable storage, cancellation, legacy configuration without a marker and absence of titles, notes, email, OTP, tokens or raw user ids.
- [x] 1.4 Add a pure first-sync reducer distinguishing `local-written`, `pending`, `remote-complete`, `error` and `indeterminate` from native `syncState`/`persistedSyncState`; verify tests prove a generic `in-sync` without initial-pull evidence is not remote completion and that an error after commit preserves the local-written evidence.
- [x] 1.5 Add isolation predicates used by the activation controller to assert that the source database, target database and source snapshot are distinct and that no source record is written to the synchronized store before consent; verify deterministic tests cover configuration, OTP, first pull, cancellation and a simulated eager native sync.

## 2. Activation assistant and application wiring

- [x] 2.1 Register `site/cloud-activation.js` in the `package.json` `check` script and verify `npm run check` still executes every syntax check and test.
- [x] 2.2 Update `site/app.js` startup so an absent/cancelled activation marker opens `threadstep-local`, an `activating` marker opens the separate synchronized database for discovery/resume, an `active` marker keeps the current synchronized startup and a legacy Cloud configuration without a marker remains active; verify `node --test tests/ts-037-activation.test.mjs` covers the four startup branches and static assertions prove `openLocalDatabase()` installs no Cloud addon.
- [x] 2.3 Add the activation assistant UI to `site/index.html`/`site/styles.css`: URL step using the validated `dexie.cloud` rule, OTP step reusing the native auth panel, visible stage/status regions, local-source explanation, review, consent, cancellation and retry controls with explicit button labels and `aria-live` status; verify static tests assert unique IDs, accessible names, `type="button"` controls, no pre-consent transfer control and no business content in status regions.
- [x] 2.4 Implement local source snapshotting in `site/app.js` by reading `threadstep-local` in a read-only transaction, projecting it with `recordsToDocument()` and explicit `indexeddb-export` provenance, then building the activation preview through `planReconciliation()`; verify tests prove identifiers and relations are preserved, quotas/conflicts are reported, and the synchronized store is not written before consent.
- [x] 2.5 Implement activation confirmation through the existing plan-bound `reviewDisplayedPlan()`/`runReconciliation()` path with only `add` operations and a re-read of source, target and destination; verify tests prove cancellation before consent leaves source/target unchanged, a changed source/target/URL/session/resolution/stale plan refuses the commit, and a repeated resume creates no duplicate.
- [x] 2.6 Implement pre-consent cancellation as a return to the local workspace with the URL retained for explicit resume, and post-commit cancellation as `transfer-pending` without pretending to undo the synchronized local copy; verify tests prove no target write on pre-consent cancellation, no local purge, and a truthful pending message after commit.
- [x] 2.7 Wire first-sync tracking from native observables and online/offline events, with a generation guard that discards stale discovery/status results and reload rebuilding from current native signals and source; verify tests cover reload during review, reload after commit, error after commit, delayed older result, URL/session changes and no restored consent or stale success message.
- [x] 2.8 Preserve the existing historical V1 offer, local conversion, JSON import/restore, diagnostic and recovery paths while the assistant is shown; verify focused static tests prove the activation code does not delete/rewrite `threadstep.document.v1`, does not purge `threadstep-local`, and does not bypass `openLocalDatabase()`/the native authentication adapter.

## 3. Cross-flow integration and regression tests

- [x] 3.1 Add fake-Cloud integration tests in `tests/ts-037-activation.test.mjs` for configuration, OTP and first pull, asserting that a seeded `threadstep-local` source produces zero synchronized mutations and zero target records before consent; verify `node --test tests/ts-037-activation.test.mjs` passes without network or IndexedDB access.
- [x] 3.2 Add fake-Cloud integration tests for a verified empty target, a partially populated target, a divergent target, permission refusal, offline/read failure, URL change, session change, reload and idempotent resume; verify every case has an explicit `verified-empty`/`populated`/`divergent`/`unavailable`/`identity-mismatch` outcome and commits only the displayed `add` operations.
- [x] 3.3 Add regression assertions for a 5-subject / 18-step local source with notes, priorities, `done`, ordering and `parentId` relations, including a 40-subject/500-step quota boundary and a target containing Cloud-only records; verify the target is never overwritten or silently merged and `node --test tests/ts-037-activation.test.mjs tests/migration-reconciliation.test.mjs` passes.
- [x] 3.4 Run the existing authentication, sync-diagnostic and reconciliation suites after wiring; verify `node --test tests/ts-037-activation.test.mjs tests/sync-diagnostics.test.mjs tests/email-otp-auth.test.mjs tests/migration-reconciliation.test.mjs` passes and no test opens a network connection or calls a paid service.

## 4. Documentation

- [x] 4.1 Update `docs/product/developer-guide.md` with the activation stages, local/synchronized database separation, activation marker, plan-bound transfer, cancellation semantics and first-sync evidence; verify the documented commands and file paths match the implementation.
- [x] 4.2 Update `docs/product/dexie-cloud-rollout.md` with the TS-037 activation journey, empty/populated/divergent/unavailable/other-account handling, local-source retention and the boundary between local commit and remote completion; verify the document labels automated runner checks and external checks separately.

## 5. Integration verification

- [x] 5.1 Run `npm run check` and report the actual test, backlog and syntax results; do not mark this task done if any command fails.
- [x] 5.2 Run `openspec validate ts-037 --strict --no-interactive` and report the actual result; do not mark this task done if validation fails.
- [x] 5.3 Inspect the final diff to confirm no application code, tests, product specs, backlog, workflows, `AGENTS.md`, secrets or configuration outside the authorized TS-037 implementation paths were changed during planning; verify `git status --short` contains only the intended implementation files.

## Manual acceptance

These checks require a real browser, an isolated Dexie Cloud test instance,
human observation and a second browser. They remain **pending human
acceptance**, are **not** completed by a green Node or CI run, and contain
**no checkbox**. Never run destructive tests against a personal or production
base.

- On Chrome mobile and desktop, create and edit local subjects for several
  days/sessions, then activate Cloud from `threadstep-local`. Verify visually
  that configuration, OTP and the first pull show no historical record on the
  target, that the assistant labels the source and destination clearly, and
  that the local source remains readable and exportable.
- With an isolated populated target, compare the preview and the actual target
  state, accept only the safe insertions, then observe an effective pull/push
  from a second browser. Verify relations, notes, priorities, ordering and
  `done` states, and that Cloud-only records were preserved.
- Interrupt the network before consent, during the first pull, during review
  and after the local commit. Verify recoverable messages, no duplicate resume,
  no false “push réussi” claim, and a distinct local-commit versus
  remote-completion status.
- Test an unavailable service, a permission refusal, a changed URL, a changed
  session and a target linked to another account/scope. Verify that the journey
  blocks or requests a new review and never copies local data to the unexpected
  identity.
- Exercise the real keyboard/focus flow with Tab/Enter/Space, the mobile touch
  targets, zoom/reflow, and screen-reader output for the assistant stages,
  consent, cancellation and status announcements.
- Reload during review, after the local commit and after remote completion.
  Verify that consent is not restored, the source remains recoverable and the
  displayed status matches the current native state.
- Report manual results separately from CI; a green runner does not prove real
  OTP delivery, mobile layout, touch, keyboard, focus, screen-reader or
  multi-device behavior.

## Post-sync review

- After the separate OPSX semantic sync, compare the canonical deltas for
  `cloud-opt-in-activation`, `cloud-sync-lifecycle` and
  `threadstep-integration-profile` with the intended ADDED behavior; verify
  that no historical canonical requirement was silently erased.
- Review the archived change and its versioned content, including the activation
  marker scope, local-source retention and the remaining TS-038/TS-040
  boundaries.
- After PR publication, verify the independent GitHub `check` on the exact final
  PR SHA, the required merge protection and the merge evidence.
- Separately verify post-merge `main` CI and the GitHub Pages deployment.
- Confirm that the isolated-Cloud Chrome mobile/second-browser manual acceptance
  was actually performed and reported, distinct from runner and CI evidence.
