# Tasks

## 1. Shared provenance-aware identity mapping

- [ ] 1.1 Add a pure provenance descriptor and canonical identity resolver in `site/migration.js` distinguishing `v1-raw`, `indexeddb-export`, `projected`, `legacy-double` and `unknown`; verify a new Node test covers each kind, including a raw ID that literally starts with `legacy:`, an unmarked prefixed source, and an unmarked plain-identifier source that must both stay ambiguous.
- [ ] 1.2 Migrate the Cloud call site (`mapSourceDocument`/`planReconciliation`), the local conversion and the compatibility `planMigration` wrapper to the shared resolver; verify a test proves the same source and provenance produce identical IDs, `subjectId` and `parentId` through the local and Cloud paths.
- [ ] 1.3 Add the optional top-level provenance block to new V1/IndexedDB exports without breaking `parseDocument`; verify a round-trip test accepts old and new files, keeps `legacy:s1` canonical, and contains no title, note, account, token or secret in the provenance block.
- [ ] 1.4 Update the TS-033 local-conversion expectations for an unmarked source: it must report ambiguity and perform zero writes until a provenance choice is supplied, whether or not its identifiers are prefixed; verify the updated local-migration tests cover refuse, explicit choice, the historical-key raw context and no `legacy:legacy:`.
- [ ] 1.5 Include the provenance choice in the plan fingerprint and expose both interpretations with counts for an ambiguous source; verify tests show the ambiguity state has zero operations and a changed provenance choice invalidates the previous fingerprint.

## 2. Regression fixture and idempotent re-import

- [ ] 2.1 Add a deterministic 5-subject / 19-task fixture with one orphan and both `legacy:s1` / `legacy:legacy:s1` variants; verify a test asserts the exact counts, the orphan, and the two variant identifiers.
- [ ] 2.2 Exercise the Cloud import through the same mapping call used by the UI with a projected export containing `legacy:s1`; verify no `legacy:legacy:` is produced, all `subjectId`/`parentId` stay coherent, and a second import produces zero duplicate operations.
- [ ] 2.3 Add import/re-import tests for raw V1, a projected export, a historical `legacy:legacy:` export with provenance, mixed duplicates, a partially populated target, nested relations, rights/realms context and Cloud-only records; verify no existing record is deleted or overwritten.
- [ ] 2.4 Add tests for outcome codes (success, ambiguous, stale, collision, transaction-error, rejected) and assert that no title, note, email, OTP, token or secret appears in any event or log payload.
- [ ] 2.5 Implement distinct import/merge and restore intentions with their own preview, scope, backup and reinforced confirmation; verify tests show a merge never deletes or replaces data implicitly and a destructive restore is never reachable as an effect of import.

## 3. Read failure taxonomy and read-only integrity inventory

- [ ] 3.1 Add typed read results for `storage-unavailable`, `read-refused`, `projection-invalid`, `not-visible-unauthorized` and `indeterminate` in the synced/local read boundary; verify a table-driven test asserts none of them becomes an empty workspace, an empty Cloud conclusion or a confirmed synchronization.
- [ ] 3.2 Implement the read-only integrity inventory over raw `subjects` and `items` with stable codes (`dangling-subject`, `dangling-parent`, `duplicate-id`, `prefix-variant`, `logical-duplicate`, `identity-collision`, `parent-inconsistency`, `content-conflict`, `invisible-or-unauthorized`, `indeterminate`); verify tests cover the 5/19 fixture, prefix variants, duplicates, permissions and zero writes.
- [ ] 3.3 Implement a tolerant read-only projection and degraded view model that keeps the 5 valid subjects readable while listing the orphan and every anomaly; verify tests assert the 19th task is listed, editing is disabled and no record is written.
- [ ] 3.4 Implement raw recovery export from the raw store arrays, including orphans and recovery-relevant metadata, with checksum and counts; verify tests assert 19 tasks are present, secrets are absent, a `lastRecords` snapshot is not used, and no export is offered when the read is refused.
- [ ] 3.5 Gate the normal V1 export while an anomaly exists: disable it with an explanation or mark it explicitly incomplete, and keep the raw recovery export distinct; verify tests cover the gating and the absence of silent omission.

## 4. Recovery UI wiring and redaction

- [ ] 4.1 Wire the read-only recovery/diagnostic panel with `createElement`/`textContent`, `aria-live`, anomaly codes and counts, and no `innerHTML`; verify static and view-model tests assert the controls, the codes and the absence of executable content.
- [ ] 4.2 Wire the raw recovery export action and the V1 export gating into `site/app.js` and `site/index.html`; verify static tests assert the distinct action, the disabled/marked-incomplete V1 path, the absence of automatic repair, and the absence of `localStorage.clear`, `deleteDatabase` and `removeItem(STORAGE_KEY)` in the recovery paths.
- [ ] 4.3 Verify no recovery/import path logs business content; add a static test asserting no `console` call interpolates titles, notes, emails, OTPs or tokens and that diagnostics expose only codes, counts and instance categories.

## 5. Conservative repair planning

- [ ] 5.1 Implement a pure repair-plan model exposing sources, target, destination/account, ID variant, proposed subject/task mapping, `subjectId`/`parentId` changes, preserved fields, ambiguous/blocked groups, before/after counts and a plan fingerprint; verify tests assert the full preview and zero writes.
- [ ] 5.2 Enforce identity proof: attach an orphan only when the selected source and provenance yield exactly one matching target identity; verify tests show `legacy:s1` vs `legacy:legacy:s1` stays blocked without evidence, becomes a deterministic proposal with evidence, and is never attached by title or prefix stripping.
- [ ] 5.3 Remap nested references coherently while preserving note, order, priority, `done`, parent/child relations and all other business fields; verify tests compare every field before and after planning and find no business difference.
- [ ] 5.4 Report ambiguous variants and content conflicts instead of selecting one, while keeping independent groups previewable; verify determinism tests produce identical plans for identical inputs and zero writes on preview/cancel.

## 6. Recovery backup, consent and repair execution

- [ ] 6.1 Implement a verifiable recovery snapshot of impacted records with checksum, counts and workspace context, stored independently of the working view; verify tests cover a valid backup, a missing backup, a corrupt backup and a count/checksum mismatch, with repair blocked in every invalid case.
- [ ] 6.2 Bind repair consent to the displayed plan fingerprint and destination identity (URL, `remoteDbId`, user category, rights/realms); verify tests show stale source/target, changed account/URL/base/permissions and mismatched consent call the adapter zero times.
- [ ] 6.3 Implement one atomic targeted repair transaction using only planned `subjectId`/`parentId` updates with compare-and-swap checks; verify tests cover a late collision, a concurrent edit, a transaction failure, no `delete`, no mass primary-key rename and no overwrite of a divergent record.
- [ ] 6.4 Verify idempotence and recovery: after a committed repair a rerun creates no operation or duplicate, an interruption before commit writes nothing, an interruption after commit is recognized after reload, and no task is lost.
- [ ] 6.5 Wire the repair preview, backup verification, explicit consent and repair action into the UI without enabling it in degraded read-only mode; verify static tests assert the consent gate, the backup requirement and the absence of automatic repair.

## 7. Truthful convergence status

- [ ] 7.1 Extend the status reduction for repairs: local-written, sync-pending/offline-pending, converged-on-this-device and indeterminate; verify tests prove a local commit or an `in-sync` signal alone is not convergence, while a native pull plus a fresh successful business read may report local convergence.
- [ ] 7.2 Preserve local repair evidence when a later synchronization error occurs and keep cross-device convergence unproven; verify tests cover the later-error transition and assert no second-device claim is produced.

## 8. Documentation and integration verification

- [ ] 8.1 Update `docs/product/developer-guide.md` and `docs/product/dexie-cloud-rollout.md` with provenance, ambiguity, degraded read, raw export, repair evidence, backup/consent and convergence limits; verify a documentation test asserts these concepts and that no secret or personal example is added.
- [ ] 8.2 Verify the change touches only authorized paths and adds no secret; run `git diff --name-only` and assert the list contains no `.github/`, `AGENTS.md`, `opencode.json`, workflow, credential or backlog file.
- [ ] 8.3 Run `npm run check`; report the actual test, backlog and syntax results and do not mark this task done if any command fails.
- [ ] 8.4 Run `openspec validate ts-035 --strict --no-interactive`; report the actual result and do not mark this task done if validation fails.

## Manual acceptance

These checks require a real browser, an isolated Dexie Cloud instance and human observation. They remain **pending human acceptance**, are **not** completed by a green Node or CI run, and contain **no checkbox**.

- Use only an isolated Dexie Cloud test instance and dedicated Chrome test profiles, never personal or production bases. Before any real action, record for each device a readable export/snapshot and an inventory, confirm the subject/task counts, back up outside the application, and then explicitly authorize a repair plan adapted to the real data. No global deletion by default.
- Reproduce the double-prefixed import and the Android-created orphan task on the laptop. In read-only mode, verify the listing, the anomaly codes and the raw export containing 5 subjects / 19 tasks with no silent omission. Verify the normal V1 export is disabled with an explanation or clearly marked incomplete.
- Apply only a repair plan based on a validated backup, after explicit consent and with the affected account, URL and `remoteDbId` displayed. Verify notes, priorities, orders, `done` states and parent relationships after reload, then verify propagation on the second device.
- Test an unstable connection, a user change, permission/realm changes, a URL change, already-present copies, concurrent modifications, and the block when the origin of a `legacy:` variant remains unknown. Verify no data is copied to another account or base.
- Verify degraded modes on Chrome Android and laptop, including keyboard Tab/Enter/Space, visible focus, touch targets, screen-reader announcement and touch interactions.
- Confirm that no title, note, email, OTP or token appears in visible logs, browser diagnostics or network diagnostics.
- Record human test evidence as manual. The CI does not attest a real recovery or a complete server synchronization.

## Post-sync review

- After the separate OPSX semantic sync, compare the canonical deltas for `data-integrity-recovery`, `data-backup-import-restore`, `data-reconciliation`, `legacy-storage-migration`, `cloud-migration-reconciliation`, `workspace-identity-isolation`, `threadstep-integration-profile` and `cloud-sync-lifecycle` with the intended ADDED and MODIFIED behavior, including the preserved existing scenarios.
- Review the archived change and its versioned content; verify that no protected factory file, workflow, secret, configuration, backlog entry or historical archive was rewritten.
- After PR publication, verify the independent GitHub `check` on the exact final PR SHA, the required merge protection and the merge evidence.
- Separately verify post-merge `main` CI and the GitHub Pages deployment.
- Confirm that the real isolated-Cloud, two-browser, Chrome Android manual acceptance was actually performed and reported; a green runner does not prove touch, keyboard, screen-reader or remote synchronization behavior.
