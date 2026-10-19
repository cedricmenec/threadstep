# Tasks

## 1. Data page markup and styles

- [ ] 1.1 Move the existing `#business-tools` block from the `.hero` header into `#settings-data-page`, preserving the unique `#export`, `#import` and `#restore` identifiers and placing each action in its « Exporter », « Importer et fusionner » or « Restaurer un état antérieur » section; add assertions in `tests/ts-042-data-page.test.mjs` that each identifier occurs exactly once and only inside `#settings-data-page`.
- [ ] 1.2 Move the existing `#restore-panel` markup into the « Restaurer un état antérieur » section, preserving every inner identifier, the `hidden` default, the replacement warning, the backup status, the `RESTAURER` confirmation field, the cancel/confirm actions and the `role="status"` region; add static markup assertions for these preserved elements.
- [ ] 1.3 Replace the descriptive-only texts with French explanations distinguishing a local IndexedDB JSON export, an additive non-destructive import/merge and a replacing restore that requires a prior safety backup and explicit confirmation; add static assertions for the three section titles and the distinguishing statements.
- [ ] 1.4 Update `site/styles.css` so the data sections stack cleanly, the file inputs stay visually hidden behind their labels, interactive targets are at least 44 × 44 px and the page does not overflow at 320 px; add deterministic CSS assertions for the selectors and declarations.
- [ ] 1.5 Add a static assertion that `#business-tools`, `#export`, `#import`, `#restore` and `#restore-panel` are absent from `.hero` and `#dashboard`, proving the home action bar is moved rather than duplicated.

## 2. Preserved handlers, visibility and restore safeguards

- [ ] 2.1 Verify and, only if the move requires it, minimally adjust `site/app.js` so `#export` still calls `exportBusinessBackup`, `#import` still uses `parseIndexedDbBackup` plus the existing local-preview/reconciliation path, and `#restore` still uses `openRestorePreview`; add source assertions that each listener is attached exactly once and no new import/export engine is introduced.
- [ ] 2.2 Preserve the existing `applyBusinessVisibility` rule for `#business-tools` under a configured, unauthenticated or account-blocked Cloud workspace; add a source assertion that the visibility condition is unchanged and that opening a settings route does not open a database, authenticate or fetch.
- [ ] 2.3 Preserve the restore guards in `site/app.js`: the panel starts hidden, `updateRestoreConfirmState` requires a downloaded backup and the exact `RESTAURER` value, and `confirmRestore` also requires an allowed plan and a fresh matching fingerprint; add deterministic source assertions for each guard.
- [ ] 2.4 Add deterministic assertions that the `hashchange`, restore-cancel and file-input reset paths contain no call to `confirmRestore`, `businessStore.commit` or any restoration write, so page change, reload preparation and cancellation cannot trigger an implicit restore.
- [ ] 2.5 Add static assertions that `#workspace-backup` remains inside `#workspace-confirmation`, that `#recovery-raw-export` remains inside `#recovery-panel`, and that their existing handlers are still attached in their original contextual flows.
- [ ] 2.6 Update `tests/ts-041-navigation.test.mjs` so its settings-page assertions expect the data controls on `#settings-data-page` instead of requiring their absence from every settings section, while keeping its route, focus, menu and presentation-only assertions intact.

## 3. Backup-engine non-regression and documentation

- [ ] 3.1 Add a deterministic fixture test in `tests/ts-042-data-page.test.mjs` that builds a business export through the existing `buildBusinessExport`/`serializeIndexedDbBackup` modules, asserts `threadstep.indexeddb-backup`, identical subject/item records and counts, and the absence of keys such as `email`, `otp`, `token`, `password`, `cloudUrl` and `remoteDbId`.
- [ ] 3.2 Add non-regression tests in the same file using `parseIndexedDbBackup` and `planReconciliation`: a modern backup is accepted, a repeated import plans no duplicate operations, duplicate identifiers and dangling references are refused, a `version: 1` document returns the unsupported-V1 refusal without writes, and malformed JSON returns a stable error code.
- [ ] 3.3 Update `docs/product/guide-utilisation.md` and `docs/product/acceptance-checklist.md` to state that export, import/merge and restore now live on `#/parametres/donnees`, that the home no longer duplicates the action bar, and that safety backups for dangerous actions and the raw diagnostic remain in their original contexts; add static documentation assertions in `tests/ts-042-data-page.test.mjs`.

## 4. Integration verification

- [ ] 4.1 Run `node --test tests/ts-041-navigation.test.mjs tests/ts-042-data-page.test.mjs tests/ts-040-backup.test.mjs` and report the actual result; do not mark this item if any test fails.
- [ ] 4.2 Run `npm run check` and report the actual output; fix any failure before marking this item complete.
- [ ] 4.3 Run `openspec validate ts-042 --strict --no-interactive` and report the actual result.
- [ ] 4.4 Run `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-042/tasks.md` and report the actual result.

## Manual acceptance

- On isolated test profiles in a real desktop browser and a real mobile browser, open the Menu, reach `#/parametres/donnees`, and use export, import/merge and restore with keyboard and touch only; verify focus visibility, labels, 44 px targets, no horizontal overflow at 320 px and an intelligible screen-reader order.
- Inspect a real exported `threadstep.indexeddb-backup` file before and after the move: verify the same records and relations, and the absence of secrets, OTP, tokens, Cloud configuration, account or authentication data.
- Import a modern backup twice and verify no duplicate; trigger a collision and a dangling reference and verify they are blocked; select an old `version: 1` file and an invalid JSON file and verify explicit messages, no write and an intact source file.
- Start a restore, verify the local backup download requirement, the exact `RESTAURER` confirmation and the displayed scope; test cancel, page change, reload and offline behavior and confirm that no implicit restore or data loss occurs.
- Verify in a real confirmation of purge, logout or workspace action that the safety JSON backup remains reachable in that same context, and that the raw recovery export remains reachable from the read-only diagnostic.
- Do not restore any production personal data for this acceptance; use synthetic fixtures and isolated test profiles only.
- These checks require real browsers, devices, touch input, keyboard navigation and human/assistive inspection; they remain **to be verified** and contain no checkbox.

## Post-sync review

- After the separate OPSX semantic sync, compare the `app-navigation` and `data-backup-import-restore` deltas with the intended ADDED/MODIFIED behavior, especially the removal of the home action bar and the preserved restore guards.
- Verify that canonical specs outside the approved deltas, archived changes and the backup/import engines were not modified beyond the presentation change.
- Check the archived OpenSpec change and its versioned content.
- After PR publication, verify the independent GitHub `check` on the exact PR SHA, the required branch protection, the merge evidence and the post-merge `main` CI and GitHub Pages deployment.
- Compare the actual manual acceptance evidence with the mobile, keyboard, screen-reader, offline and isolated-profile requirements; never report a check as passed before its evidence exists.
- This review is external to `apply`, contains no checkbox and remains open until its evidence exists.
