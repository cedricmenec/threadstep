# Tasks

## 1. Displayed-plan consent and ordered revalidation

- [x] 1.1 Add a pure displayed-plan review helper in `site/migration-reconciliation.js` that compares the rendered plan with a freshly built plan, including status, fingerprint, ordered `add` operations and blocked groups; verify deterministic tests in `node --test tests/ts-036-consent.test.mjs` pass for unchanged, changed source, target, destination, user, resolution, order, blocked group and `already-migrated` results.
- [x] 1.2 Extend `runReconciliation` so an optional freshly built plan from the revalidation payload must match the displayed plan’s ordered operations and blockers before `commit`; verify `node --test tests/ts-036-consent.test.mjs` covers missing/mismatched request consent, reordered operations, changed blockers, stale identity/target and zero adapter calls on refusal.
- [x] 1.3 Capture `previewFingerprint` and the ordered operation projection when `site/app.js` renders a plan, and make `confirmReconciliation` re-render and clear consent when the fresh plan differs instead of assigning the fresh fingerprint as consent; verify `node --test tests/ts-036-consent.test.mjs` passes its static source assertions and the existing `node --test tests/migration-reconciliation.test.mjs` still passes.

## 2. Reconciliation regression coverage

- [x] 2.1 Add a focused regression for a 5-subject / 18-step source reconciled into a populated target, asserting that Cloud-only records and non-conflicting groups are preserved and that only independent absent records are emitted as `add`; verify `node --test tests/migration-reconciliation.test.mjs` passes.
- [x] 2.2 Extend deterministic coverage for subject and sub-step conflicts, relative order changes, late collisions, divergent source/target, quotas and repeated runs without duplicates; verify `node --test tests/migration-reconciliation.test.mjs` passes and no test writes to a shared fixture.

## 3. Offer, dismissal and footer lifecycle core

- [x] 3.1 Add `site/migration-lifecycle.js` with pure dismissal-key/store helpers, the historical-offer decision, a generation guard and the footer ownership reducer, and register it in `package.json` `check`; verify `node --check site/migration-lifecycle.js` succeeds and `node --test tests/ts-036-lifecycle.test.mjs` passes.
- [x] 3.2 Add lifecycle tests proving that an already-reconciled target suppresses the automatic import request and insertions, an explicit dismissal is scoped by source fingerprint, URL, `remoteDbId` and user, a source/URL/account change reopens verification, an explicit request bypasses suppression, unavailable storage fails safely, and dismissal metadata contains no business content or raw identity; verify `node --test tests/ts-036-lifecycle.test.mjs` passes.
- [x] 3.3 Add footer reducer tests proving a migration block is replaced by a verified current message after a healthy re-evaluation, a real storage/read error survives migration clearing, no remote synchronization is announced, and a stale generation cannot replace a newer message; verify `node --test tests/ts-036-lifecycle.test.mjs` passes.

## 4. Application lifecycle wiring

- [x] 4.1 Wire `site/app.js` so the historical offer is generation-guarded and re-evaluated on `currentUser`, `syncState`, `persistedSyncState`, online/offline, Cloud URL and `threadstep.document.v1` storage events; verify `node --test tests/ts-036-lifecycle.test.mjs` passes its static wiring assertions for generation capture, identity/source comparison before rendering, and dropping stale results.
- [x] 4.2 Make the panel render `blocked`, `preview`, `already-reconciled`, `dismissed` or `closed` from the current offer decision, preserve checked consent only when the displayed fingerprint is unchanged, and reset it on a changed plan; verify `node --test tests/ts-036-lifecycle.test.mjs` passes the decision and static renderer assertions.
- [x] 4.3 Add a Cloud-mode retained V1 area with a download action and an explicit verification action, keep the local-mode notice/export/conversion unchanged, and verify `node --test tests/ts-036-lifecycle.test.mjs` asserts accessible labels, `type="button"` controls, literal text rendering and the absence of any `threadstep.document.v1` removal or rewrite.
- [x] 4.4 Route migration messages through the owned, generation-bound footer helper so a later storage/read error is not erased and a stale block cannot overwrite a recent status; verify `node --test tests/ts-036-lifecycle.test.mjs` passes the footer ownership and ordering tests and `node --test tests/sync-diagnostics.test.mjs` still passes.

## 5. Documentation and integration verification

- [x] 5.1 Update `docs/product/developer-guide.md` and `docs/product/dexie-cloud-rollout.md` with the displayed-plan consent, ordered revalidation, generation-guarded offer, dismissal scope, retained-access and footer lifecycle rules, and verify `node --test tests/ts-036-lifecycle.test.mjs` passes its documentation assertions.
- [x] 5.2 Run `npm run check` and report the actual test, backlog and syntax results; do not mark this task done if any command fails.
- [x] 5.3 Run `openspec validate ts-036 --strict --no-interactive` and report the actual result; do not mark this task done if validation fails.

## Manual acceptance

These checks require a real browser, an isolated Dexie Cloud test instance and
human observation. They remain **pending human acceptance**, are **not**
completed by a green Node or CI run, and contain **no checkbox**. Never run
destructive tests against a personal or production base.

- With an isolated Cloud test instance and two browsers, modify data between the
  preview and the confirmation; confirm that the old consent is refused, the new
  inventory is shown, no commit occurs, and the copies, hierarchy and idempotence
  behave correctly on Chrome mobile.
- Reproduce the reported case: healthy JSON restore, records replicated between
  Android and laptop, an old `threadstep.document.v1` still present, a transient
  disconnection showing “Migration temporairement bloquée”, then a restored
  `connected / in-sync` state. Verify that the panel and footer stale messages
  disappear, that the retained V1 source is still exportable, and that the
  current plan or “no migration needed” status is truthful.
- Simulate a destination change, a real blocking condition and the late arrival
  of an older asynchronous result after a newer one; verify that the latest
  state wins, that no automatic import occurs, and that no V1 data is lost.
- Verify the retained V1 area and explicit verification action on mobile and
  desktop with touch, Tab/Enter/Space, visible focus and screen-reader names,
  including after an explicit dismissal and after an `already-migrated` result.
- Confirm that a real storage/read error remains visible when a migration block
  disappears and that no footer message claims remote synchronization without
  native proof.
- These checks must be reported separately from the CI result; a green runner
  does not prove mobile, touch, keyboard, screen-reader or real Cloud behavior.

## Post-sync review

- After the separate OPSX semantic sync, compare the canonical deltas for
  `data-reconciliation`, `cloud-opt-in-activation` and `cloud-sync-lifecycle`
  with the intended MODIFIED and ADDED behavior; verify that no historical
  canonical requirement was silently erased.
- Review the archived change and its versioned content, including the dismissal
  metadata scope, retained V1 access and the remaining TS-040 boundary.
- After PR publication, verify the independent GitHub `check` on the exact final
  PR SHA, the required merge protection and the merge evidence.
- Separately verify post-merge `main` CI and GitHub Pages deployment.
- Confirm that the isolated-Cloud manual acceptance was actually performed and
  reported, distinct from the runner and CI evidence.
