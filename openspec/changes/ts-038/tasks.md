# Tasks

## 1. Pure workspace identity model

- [ ] 1.1 Create `site/workspace-identity.js` with the versioned registry key, URL normalization, allowlisted entry parsing/serialization including schema version, selected-workspace resolution and legacy-config migration; add `tests/workspace-identity.test.mjs` covering valid round-trip, unknown version, malformed URL, invalid status and rejection of email/token/raw-user keys, then run `node --test tests/workspace-identity.test.mjs`.
- [ ] 1.2 Add the deterministic per-URL synchronized base-name helper in `site/dexie-foundation.js` using `sha256Hex` and an explicit legacy-name override; extend `tests/dexie-foundation.test.mjs` to assert same-URL stability, distinct names for colliding native suffixes, legacy name preservation and no schema/dependency change.
- [ ] 1.3 Implement startup and selection resolution that combines the registry, the legacy Cloud config and the activation record, including local, synchronized, suspended and cancelled outcomes; add tests for A/B/A routing, each workspace opening its own base and no copy/merge operation in the decision result.
- [ ] 1.4 Implement account-binding evaluation from an opaque user digest and cache-emptiness evidence; add tests for matching binding, different account on the same URL, unverified legacy cache with records, empty unverified cache, logout-cleared cache and unauthenticated/indeterminate states.
- [ ] 1.5 Implement pure action planners for selection, suspension, logout and purge with injected pending-change status; add tests for `none`, `pending`, `unknown`, cancellation, explicit continuation, selected-base-only purge and the absence of any business-delete operation in all plans.
- [ ] 1.6 Implement a redacted workspace-diagnostic contribution exposing workspace type, effective base, normalized URL, available `remoteDbId`, session category and binding category; add tests asserting no email, OTP, token, raw user id, title, note or raw error appears, and that values change with workspace/session/URL.

## 2. Activation record extension

- [ ] 2.1 Extend `site/cloud-activation.js` with the suspended status in creation/parsing/startup routing while keeping unknown statuses fail-closed; extend `tests/ts-037-activation.test.mjs` to assert suspended parsing, local startup for suspended entries, preserved destination and resume to the same synchronized base without a new consent.
- [ ] 2.2 Add registry/marker synchronization helpers so selecting or suspending an entry updates both the registry status and the legacy activation key without discarding URL, `remoteDbId`, source fingerprint or user digest; add tests for bidirectional consistency and safe degradation when storage is unavailable.

## 3. Application wiring and observable UI contract

- [ ] 3.1 Add the workspace panel markup to `site/index.html` with labelled select, status region, select/suspend/logout/purge buttons, inline confirmation region, cancel and JSON-backup controls, plus minimal `site/styles.css` rules; add a static test asserting the required ids, French text labels and absence of user content injected as HTML.
- [ ] 3.2 Wire `bootstrapSyncedDatabase()` to use the registry entry's effective base name, keep `nameSuffix` and `requireAuth: true` unchanged, and preserve the legacy base for migrated entries; add a static test asserting these options and the base-name source.
- [ ] 3.3 Wire registry initialization, synthesized legacy migration and selected-workspace startup; add an integration test asserting A/B/A selects the recorded bases, suspended entries start locally, and no purge/delete call occurs during migration or selection.
- [ ] 3.4 Gate the synchronized business read and native subscriptions behind the account-binding check before `refreshSyncedDocument()`; add tests or static assertions that mismatch/unverified states render no business records and issue no business write.
- [ ] 3.5 Wire suspension, selection, logout and purge to the pure planners and injected native adapter; re-run the pending diagnosis immediately before the confirmed logout and call native `db.cloud.logout({ force: true })` only after ThreadStep's own explicit confirmation, never before it; assert with a fake adapter that no business delete or remote erasure is called.
- [ ] 3.6 Wire purge to close the displayed workspace and call Dexie physical database deletion on the effective base name only, leaving legacy config, other entries and `threadstep-local` untouched; add a static test asserting no `table.delete`/business deletion path is introduced.
- [ ] 3.7 Wire the pending-change warning and JSON snapshot to the existing business export, including cancel and explicit-continue states; add deterministic tests for warning copy, snapshot readiness and blocked purge/logout before confirmation.
- [ ] 3.8 Pass workspace type, effective base, URL, `remoteDbId`, session and binding categories into `site/sync-diagnostics.js`; extend `tests/sync-diagnostics.test.mjs` for the new rows, mismatch display, redaction and refresh on session/URL change.

## 4. Repository checks

- [ ] 4.1 Add `site/workspace-identity.js` to the `node --check` chain in `package.json`; add a test asserting the check command covers every new runtime module and that no dependency or Dexie schema version changed.
- [ ] 4.2 Run `npm test` and report the actual pass/fail counts; do not mark this item if any test fails.
- [ ] 4.3 Run `npm run check` and `openspec validate ts-038 --strict --no-interactive`; report the actual output and keep the item unchecked if either command fails.
- [ ] 4.4 Run `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-038/tasks.md` and confirm the executable pre-sync checklist gate accepts this plan.

## Manual acceptance

- Use two real test accounts and two real threadstep test URLs on an isolated Dexie Cloud instance, with a fallback JSON export; never use personal data or a production base.
- Perform an A/B/A URL journey, confirm that A and B keep separate subjects, steps, notes and resume state, that returning to A reopens its own data, and that no base is purged or copied.
- Alternate the two accounts on the same URL, including a session expiry followed by another account login, and confirm that private records of the first account are never shown, exported or written for the second.
- Create pending changes, then exercise logout and local purge separately; check the warning, the JSON snapshot, cancellation, explicit continuation and the fact that the Cloud test base keeps all its records.
- Suspend Cloud, return to the autonomous workspace, confirm local work is intact, then resume and confirm the same destination, base and session are reused without a new transfer.
- Review the panel visually on desktop and mobile, use only the keyboard (Tab, Enter, Space, Escape), check focus return after cancellation, touch target size at least 44 px, accessible names and screen-reader announcements.
- Verify native logout behavior on the pinned Dexie Cloud version, including the unsynced-change path, and record the observed evidence separately from the automated tests.
- These checks are pending human acceptance, are not proven by the Node test runner and carry no checkbox.

## Post-sync review

- After the separate OPSX semantic sync, compare each delta against the canonical specs for `workspace-identity-isolation`, `cloud-opt-in-activation`, `dexie-cloud-configuration` and `dexie-local-database`, and confirm the intended ADDED/MODIFIED behavior without altering archived history.
- Check the archived OpenSpec change and its versioned contents, including the suspended status and the legacy-base migration contract.
- After the PR is published, verify the independent GitHub `check` on its exact SHA, the required protection, the merge evidence, post-merge CI on `main` and the Pages deployment.
- Keep manual two-account, A/B/A, logout, purge and mobile results distinct from CI evidence; never present an unperformed manual check as passed.
- This review is external to `apply` and carries no checkbox until its evidence exists.
