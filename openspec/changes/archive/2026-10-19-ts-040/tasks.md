# Tasks

## 1. Modern IndexedDB backup contract

- [x] 1.1 Add a pure modern backup serializer/parser for `format: "threadstep.indexeddb-backup"`, format version 1, provenance, counts, records and checksum; verify with a Node unit test that a round-trip of subjects, items, notes, order, priorities, `done`, `subjectId` and `parentId` preserves every field.
- [x] 1.2 Make the parser reject malformed structure, unknown format/version, duplicate IDs, dangling references, quota overflow, count mismatch and checksum mismatch with stable result codes; verify each case in `node --test` without any write callback being invoked.
- [x] 1.3 Make the parser reject any `version: 1` document and any file without the modern format with an explicit `unsupported-v1-backup`/`unknown-format` code; verify that no mapper or write adapter is called for those inputs.
- [x] 1.4 Replace the normal business export builder so it serializes committed `subjects`/`items` records directly instead of `recordsToDocument`/`version: 1`; verify with Node tests for a 5-subject/18-step workspace plus one extra task and for canonical IDs already starting with `legacy:`.
- [x] 1.5 Wire local import/merge to the modern parser and canonical records; verify with deterministic tests that the same backup imported twice yields zero operations, a different existing ID is a collision with no write, and an invalid/V1 file leaves the target unchanged.
- [x] 1.6 Wire restore and Cloud JSON import/reconciliation to the modern records and fingerprint-bound plan; verify with Node tests for complete restore into an empty target, a reimport with zero duplication, a stale plan with no operation, and Cloud-only records preserved.
- [x] 1.7 Add pure message/result helpers for the transition notice and unsupported-V1 refusal; verify with Node tests that the notice invites a modern backup without deleting data and that the refusal never contains a conversion path.

## 2. Retire the V1 runtime

- [x] 2.1 Remove V1 detection, migration offers, dismissals, historical panels, legacy export actions, `historicalGuard`/`compatibilityGuard` and the `STORAGE_KEY` storage-event branch from `site/app.js`; verify with static Node assertions that none of these symbols remains in the runtime source.
- [x] 2.2 Remove user-facing V1 parsing from import, restore, local merge and Cloud import paths; verify with a source-scan test that no import/restore handler calls `parseDocument` or any V1 detection helper and that legacy-key reads are confined to cleanup inventory.
- [x] 2.3 Remove or refactor the obsolete migration modules and their exports while keeping provenance and reconciliation helpers required by modern imports; verify `node --check` on every `site/*.js` file and a static import test.
- [x] 2.4 Delete or rewrite tests that encode the old V1 offer/conversion/export behavior and replace them with assertions that the legacy value is inert, triggers no mutation and produces no network/Cloud call; verify with `node --test tests/*.test.mjs`.
- [x] 2.5 Add a deterministic source test that fails if a user-facing path accepts a `version: 1` document, exports a V1 envelope, or calls `localStorage.clear()`/`indexedDB.deleteDatabase()` in normal startup or cleanup flows.

## 3. Local metadata store and preference migration

- [x] 3.1 Add an explicit Dexie schema version with a string-keyed `meta` store in the local and synchronized schemas and declare `meta` as unsynchronized in the Cloud configuration; verify with a Node schema test that the version is explicit and the store is listed in `unsyncedTables`.
- [x] 3.2 Implement the versioned preference/metadata migration from `threadstep.resume.v1` and local migration metadata into `meta`; verify with Node tests for first migration, repeat migration without duplication, already populated target not overwritten, and crash/reload resume.
- [x] 3.3 Handle unavailable metadata writes and duplicate/conflicting values without deleting the legacy key or claiming durable storage; verify with a failing-write adapter test and a conflict test.
- [x] 3.4 Route resume-preference reads/writes through the local metadata cache/store and remove runtime dependence on `threadstep.resume.v1`; verify with a static test that `site/app.js` no longer writes `RESUME_KEY` and with reload tests using the metadata store.
- [x] 3.5 Keep workspace isolation by storing metadata in each workspace database; verify with a two-database test that preferences are not copied between them and that no business content appears in `meta` or in the modern export.

## 4. Voluntary legacy-key cleanup

- [x] 4.1 Implement a cleanup inventory that lists only `threadstep.document.v1`, `threadstep.migration.v1`, `threadstep.resume.v1` and `threadstep.migration.dismissals.v1` when present, without parsing their values; verify with a Node test for the exact key list and absent technical Cloud keys.
- [x] 4.2 Implement cleanup guards requiring a verified modern backup in the current session and a completed metadata migration, defaulting to "ne rien effacer"; verify with deterministic tests for each disabled state and for no deletion without confirmation.
- [x] 4.3 Implement consented cleanup using targeted `removeItem` calls only; verify with tests that cancellation/error leaves values intact, that only listed keys are removed, and that IndexedDB, Cloud settings and unrelated keys are untouched.
- [x] 4.4 Add a deterministic test that no automatic startup, reload, login, sync or migration path invokes cleanup, and that `localStorage.clear()`/`indexedDB.deleteDatabase()` are never present.
- [x] 4.5 Wire the cleanup inventory, confirmation and results to the existing workspace controls; verify with static DOM/state assertions and the cleanup unit tests.

## 5. Documentation and canonical spec alignment

- [x] 5.1 Update `docs/product/specs/dexie-data-lifecycle-target-v1.md` to record the completed transition, the modern backup format and the V1 retirement; verify with a grep test for the modern format name and the non-support statement.
- [x] 5.2 Update `docs/product/developer-guide.md`, `docs/product/guide-utilisation.md`, `docs/product/mvp.md` and `docs/product/acceptance-checklist.md` so they describe IndexedDB-only business storage, the modern backup and voluntary cleanup; verify with a documentation test that no current guidance instructs importing/restoring V1 backups.
- [x] 5.3 Implement a deterministic Node regression test included in `npm run check`, with active-change assertions confirming that the `legacy-storage-migration` and `legacy-document-migration` OpenSpec deltas explicitly retire V1 readers, keep legacy keys inert, reject V1 imports without writes and require voluntary cleanup; its completed-change assertions MUST inspect the real canonical `## Purpose` sections of both capabilities and reject wording that still promises active V1 conversion. Select the assertions using the presence of the active change or its archived counterpart, and exercise both modes with deterministic fixtures during `apply` without editing canonical specs.
- [x] 5.4 Verify no archived change under `openspec/changes/archive/` is modified.

## 6. Integration verification

- [x] 6.1 Run `npm run check` and report the actual result; fix failures before marking this task complete.
- [x] 6.2 Run `openspec validate ts-040 --strict --no-interactive` and report the actual result.
- [x] 6.3 Run `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-040/tasks.md` and report the actual result.

## Manual acceptance

- On a real desktop browser and a mobile browser, export the workspace with the new format from both a local-only IndexedDB workspace and a connected test workspace, reload, then restore into a clean test profile and confirm the 5 subjects, 18 steps plus the extra task, hierarchy, notes, priorities, order and `done` states.
- Perform two successive imports of the same modern file and confirm no duplication; provoke a collision and a preview changed before confirmation and confirm no loss.
- Simulate the presence of an old `threadstep.document.v1` value and confirm no historical migration panel, no legacy export action and no implicit Cloud traffic reappear.
- Present a real V1 file and a V1 document to import and restore, confirm the explicit refusal and verify that nothing was erased.
- On a test profile only, choose "ne rien effacer", then perform "supprimer uniquement les anciennes clés V1" and confirm the origin/browser scope; repeat cancellation and error paths and verify the values remain.
- Verify the transition notice, backup verification and cleanup controls with keyboard, focus, touch targets and screen-reader output.
- On real Android/laptop devices, confirm the modern export/restore hand-off; no deletion or transition step is considered accepted on real devices merely because Node tests pass.
- These checks remain required for truthful acceptance but are not claimed as completed here and contain no checkbox.

## Post-sync review

- After the separate OPSX semantic sync, compare the canonical spec deltas with the intended modern backup, V1 rejection, metadata and cleanup behavior.
- Explicitly verify the `## Purpose` sections in `openspec/specs/legacy-storage-migration/spec.md` and `openspec/specs/legacy-document-migration/spec.md` describe V1 retirement, inert historical values and voluntary cleanup, without promising an active V1 conversion. Native OPSX sync MUST NOT be presumed to rewrite Purpose. If either Purpose remains stale, correct it on the delivery branch during the post-sync review, then rerun `npm run check` (including completed-change canonical assertions) and `openspec validate --all --strict --no-interactive`; do not merge while either check fails.
- Review the archived change and confirm archived historical changes were not modified.
- Verify the independent GitHub `check` on the exact SHA of the implementation PR, the required protection, the merge evidence, and post-merge `main` CI and GitHub Pages.
- Verify separately that modern backups were regenerated and checked during the transition and that the real Android/laptop acceptance was performed; do not attribute that evidence to the Node CI.
- This stage is external to `apply`; it contains no checkbox and must never be marked complete before its evidence exists.
