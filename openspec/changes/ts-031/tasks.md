# Tasks

## 1. Reconciliation core and inventory

- [x] 1.1 Add the pure reconciliation module and register it in `package.json` `check`; verify `node --check` succeeds for the new module and `node --test tests/migration-reconciliation.test.mjs` runs the new file.
- [x] 1.2 Implement source/target business normalization with the field allowlist (subject title/order; item subject, parent, title, note, priority, `done`, order), omitting an absent note; verify tests show identical records despite `owner`, `realmId`, `$ts` and unknown metadata, and flag each real title, note, priority, `done`, subject, parent and order change.
- [x] 1.3 Implement store-separated inventories and the five categories (`identical`, `absent-in-cloud`, `conflict`, `cloud-only`, `invalid/indeterminate`); verify tests cover the same id in both stores, a Cloud-only record, duplicate mapped source ids and dangling target relations.
- [x] 1.4 Implement relative order comparison and deterministic insertion placement for interleaved Cloud-only records; verify tests cover an unchanged relative order with extra Cloud records, a real reversal, absent neighbours, end placement and no false order conflict.
- [x] 1.5 Implement deterministic, side-effect-free plan output; verify two runs over the same inputs produce identical inventory and operations and that planning writes nothing to the fake source or target stores.

## 2. Attested initial synchronization

- [x] 2.1 Implement `evaluateSyncAttestation` over injected online/user/sync-state/persisted-state/database inputs; verify tests for attested, offline, unauthenticated, initial-sync-pending, sync-error, realm/session mismatch, missing `remoteDbId`/`serverRevision` and indeterminate inputs.
- [x] 2.2 Wire the attestation before the target read and make every non-attested reason block planning; verify an injected sequence test proves the target reader is not called when attestation fails and is called after success.
- [x] 2.3 Make target read errors explicit rather than empty; verify tests show an empty IndexedDB target with a pending attestation and a thrown read never produce a plan, a Cloud-empty conclusion or a write.

## 3. Partial non-overwriting reconciliation

- [x] 3.1 Implement dependency-aware partial planning and quota checks (40 subjects, 500 items per subject); verify the 5-subject / 18-step fixture against a partially populated target inserts only absent independent subjects and steps.
- [x] 3.2 Implement branch blocking for unresolved conflicts and quota overflow; verify tests show a conflicting step blocks its descendants and subject branch while an independent subject branch is still planned, and that an overflowing branch is excluded without blocking other branches.
- [x] 3.3 Verify identical and Cloud-only records receive no operation and every planned insertion preserves `subjectId`/`parentId` relations; verify tests assert operations are `add` only and contain no `put`, `delete` or unknown type.

## 4. Conflict resolution and deterministic copies

- [x] 4.1 Implement keep-Cloud and import-as-copy resolutions for subject and sub-step conflicts, with unresolved as an explicit non-destructive exclusion; verify tests show keep-Cloud changes neither target nor V1, no default resolution is destructive, and the source/export remains readable.
- [x] 4.2 Implement deterministic copy ids bound to source and destination, availability checks and parent/descendant remapping; verify tests prove the same source and destination yield the same id, a different destination may differ, children/parents are coherent, and the original target is untouched.
- [x] 4.3 Verify copy idempotence and collision handling; tests must show a second run/reload creates no second copy, an already-identical copy is recognized as applied, and an unavailable copy id with different content blocks only that copy branch.

## 5. Plan-bound consent and atomic commit

- [x] 5.1 Implement canonical source, destination, user and target-projection fingerprints plus the plan fingerprint; verify tests cover a source change, URL change, remote-database change, user/session change, target change, conflict change and resolution change producing a different fingerprint.
- [x] 5.2 Implement `runReconciliation` pre-commit revalidation below the UI; verify tests show missing/false/mismatched consent and each stale condition call the adapter zero times and write nothing, while an unchanged plan calls it exactly once.
- [x] 5.3 Implement the atomic add-only adapter contract and anti-overwrite checks; verify tests show a collision after revalidation rolls back the whole transaction without overwrite, a mid-transaction failure leaves the previous target and source intact with an error status, and a fully committed run is idempotent after reload.

## 6. Truthful status

- [x] 6.1 Implement the migration status reducer for local-written, sync-pending, synced, sync-error and offline-pending; verify tests prove a local commit never reports synced, a later sync-complete with healthy attestation may report synced, and a later sync error preserves the local-write evidence while reporting the sync error separately.

## 7. Accessible preview and application wiring

- [x] 7.1 Implement the pure reconciliation view model and the DOM renderer using `createElement`/`textContent` only; verify static and unit tests cover category counts, destination, conflict field names, labelled `fieldset`/radio choices, `type="button"` controls, `aria-live`, focus target, no `innerHTML` and no business content in `console` calls.
- [x] 7.2 Wire the historical migration and Cloud JSON import through the same plan, preview, consent and revalidation, while keeping the local-only JSON import unchanged; verify static tests assert the shared calls, the explicit consent separate from OTP, the add-only adapter, and the unchanged local import branch.
- [x] 7.3 Update `docs/product/developer-guide.md` and the Dexie Cloud rollout notes with the attested preflight, partial reconciliation, keep-Cloud/copy semantics, truthful status and remaining manual Cloud limits; verify documentation tests assert the TS-031 concepts and `npm run check` includes the new module.

## 8. Integration verification

- [x] 8.1 Run `npm run check`; report the actual test, backlog and syntax results and do not mark this task done if any command fails.
- [x] 8.2 Run `openspec validate ts-031 --strict --no-interactive`; report the actual result and do not mark this task done if validation fails.

## Manual acceptance

These checks require a real browser, a real isolated Dexie Cloud instance and human observation. They remain **pending human acceptance** and are **not** completed by a green Node or CI run.

- Use only an isolated Dexie Cloud test instance, with prior JSON/V1 backup exports; never run destructive reconciliation against a personal or production base.
- On Chrome mobile and a second browser, verify the attested waiting state, a first synchronization that is not finished, and the absence of a false "Cloud empty" conclusion.
- Reconcile a V1 source of 5 subjects and 18 steps into an already-populated target; inspect the category counts, effective destination, conflicting records and differing fields.
- Exercise keep-Cloud and import-as-copy for one subject conflict and one sub-step conflict; verify hierarchy, absence of a second copy after refresh/reload, and preservation of the V1 key and historical JSON export.
- Exercise an independent absent group import, a cancellation, a refusal, a reconnect and a refresh; verify the real network propagation and the distinction between local write, pending sync, synced and error.
- Verify touch operation, 44 px touch targets, Tab/Enter/Space navigation, focus visibility and screen-reader names on the preview and conflict choices.
- Exercise offline start, offline import attempt and loss of connection between preview and confirmation; verify no write and no destructive default.
- Confirm that titles and notes are displayed as literal text and that no business content appears in browser logs or network diagnostics.

## Post-sync review

- After the separate OPSX semantic sync, compare the canonical spec deltas with the intended ADDED and MODIFIED behavior, including the reconciliation and legacy-migration requirements.
- Review the archived change, its versioned content and the documented limitations; verify no protected factory file, secret or backlog entry was modified by apply.
- After PR publication, verify the independent GitHub `check` on the exact final PR SHA, the required merge protection, and the merge evidence.
- Separately verify post-merge `main` CI and the GitHub Pages deployment; these are not proven by Node tests.
- Confirm that the real isolated-Cloud manual acceptance was actually performed and reported; a green runner does not prove Chrome mobile, touch, keyboard, screen-reader or remote synchronization behavior.
