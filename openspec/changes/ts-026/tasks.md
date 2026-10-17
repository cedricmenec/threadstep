# Tasks

## 1. Historical V1 document detection and preservation

- [ ] 1.1 In a new pure `site/migration.js` module, implement `detectHistoricalDocument(storage)` that reads `STORAGE_KEY` and returns the document only when `parseDocument` accepts it, otherwise a typed rejection; verify with deterministic Node tests using a fake storage that a valid document is returned, that an invalid or unreadable value yields a rejection with no migration plan, and that an absent value is reported as absent.
- [ ] 1.2 Implement the preservation projection from the validated document to the fine-grained records through the existing `documentToRecords` and a V1 reproduction through `recordsToDocument`; verify with deterministic Node tests that subjects, items, ids, `parentId`, notes, priorities, order and `done` are unchanged and that the local resume preference stays out of the records.
- [ ] 1.3 Add `site/migration.js` to the `package.json` `check` script with `node --check`; verify with a deterministic assertion that the module is covered and that `node --check site/migration.js` exits successfully.

## 2. Consent disclosure and gate

- [ ] 2.1 Implement `describeMigration(document, destination, records)` returning the destination, the transferred subject and item counts and the future synchronization effect; verify with deterministic Node tests that the disclosure identifies the destination, reports the counts and states that the data will be synchronized before any execution.
- [ ] 2.2 Gate `runMigration` behind an explicit consent flag; verify with deterministic Node tests that without consent no operation reaches the injected in-memory store, and that with consent the derived records are committed once.

## 3. Atomic and idempotent migration with collision handling

- [ ] 3.1 Implement `planMigration(records, document, options)` returning one operation set and `runMigration` committing it in a single `commit(operations)` call through the injected adapter; verify with deterministic Node tests that a confirmed migration emits one operation set and that a forced commit failure leaves the in-memory store unchanged with no partial record.
- [ ] 3.2 Implement idempotent re-run and duplication detection; verify with deterministic Node tests that a second confirmed run over an already-migrated target produces an empty operation set and that no subject or item is duplicated.
- [ ] 3.3 Detect identifier collision and a populated target without silent overwrite; verify with deterministic Node tests that an existing id with different content is reported as a collision and left unchanged, that a non-empty target is reported, and that a refused decision leaves the existing records intact.

## 4. Stable legacy identifier mapping

- [ ] 4.1 Implement `mapLegacyId` and record remapping that deterministically and injectively remap `id` and `parentId`; verify with deterministic Node tests that the same legacy id maps to the same key across repeated calls, that every `parentId` follows its parent's key and that the V1 export identifiers are preserved.

## 5. Non-destructive failure and cross-base isolation

- [ ] 5.1 Ensure no migration path erases or destructively rewrites the historical value; verify with deterministic Node tests using a fake storage that after a refusal, an exception and an interrupted run the `threadstep.document.v1` value is byte-identical and `exportDocument` still returns the historical content, and with static assertions that the migration module contains no `removeItem(STORAGE_KEY)` call.
- [ ] 5.2 Bind the migration to the disclosed destination and abort on a change; verify with deterministic Node tests that a destination mismatch aborts before the commit and leaves both the source and the in-memory store unchanged.
- [ ] 5.3 Ensure a destination change alone never imports data; verify with deterministic Node tests that changing the destination configuration produces no migration plan and copies no record between bases.

## 6. Application wiring, purity and documentation

- [ ] 6.1 Wire the `site/app.js` consent surface and the Dexie adapter to `runMigration` while keeping `site/core.js` pure; verify with static assertions that the consent gate precedes the commit call, that the migration uses the injected `commit(operations)` adapter, and that `core.js` still contains no `fetch`, `XMLHttpRequest`, `localStorage`, `indexedDB` or DOM primitive.
- [ ] 6.2 Update `docs/product/developer-guide.md` and `docs/product/mvp.md` to describe the consent-gated migration, its atomicity and idempotence and its non-destructive guarantees; verify with deterministic assertions that the new text is present, that the historical-data note is reconciled and that `npm run backlog:check` passes.

## 7. Integration checks

- [ ] 7.1 Run `npm run check`; report the exact command and its real output, and do not mark earlier tasks complete if it fails.
- [ ] 7.2 Run `openspec validate ts-026 --strict --no-interactive` and `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-026/tasks.md`; report the exact commands and their real output, and do not mark earlier tasks complete if either fails.

## Manual acceptance

- On a real desktop and mobile browser profile that already holds a rich historical `threadstep.document.v1` (subjects, nested substeps, notes, mixed priorities, a resume preference), open the app against an isolated test Dexie Cloud instance and an authorized Pages origin; confirm the consent surface shows the destination, the data to transfer and the synchronization effect before any write.
- Accept the migration and confirm in the real browser that subjects, substeps, notes, priorities, ordering, completion states and the resume tracking are preserved, that a reload shows no duplicate, and that re-opening the flow reports the document as already migrated.
- Refuse the migration and confirm that the historical key, the JSON export and the cloud base remain unchanged; then repeat with a forced interruption (close the tab mid-flow) and a simulated failure, and confirm the flow can be retried without duplication.
- Inspect the real browser `localStorage` and the IndexedDB base before and after each attempt to confirm the source is physically retained and no unsynchronized data is presented as recoverable.
- Against a non-empty target base, confirm the app reports the existing data and does not overwrite it without an explicit decision, and confirm an identifier collision is surfaced rather than silently overwritten.
- Change the configured Dexie Cloud URL and confirm no historical or base data is imported or copied into the other base.
- Navigate the consent surface with the keyboard alone, check focus, live-region announcements and touch targets on mobile, and check screen-reader output where possible.
- These are pending human acceptance, not completed by any green Node test, and contain no checkbox.

## Post-sync review

- After the separate OPSX semantic sync step, compare the canonical delta for `legacy-document-migration` (ADDED) against the intended behavior and confirm that no other requirement changed.
- Check the archived OpenSpec change and its versioned content.
- After the PR is published, verify the independent GitHub `check` job on the exact head SHA, the required branch protection, the merge evidence and the post-merge CI / GitHub Pages deployment.
- This stage is external to `apply`; these reviews contain no checkbox and must never be marked complete before their evidence exists.
