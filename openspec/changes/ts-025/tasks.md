# Tasks

## 1. Fine-grained entity model and V1 projection

- [ ] 1.1 In a new pure `site/persistence.js` module, define separate subject and step record shapes with globally unique stable string identifiers and the preserved `parentId`, order, `priority`, `done`, `title` and optional `note` fields; verify with deterministic Node tests that every record carries a globally unique id, that no record uses an auto-incremented key, and that the declared synchronized stores still pass `validateSynchronizedStores`.
- [ ] 1.2 Implement pure `documentToRecords` and `recordsToDocument` functions reproducing the exact V1 JSON shape; verify with deterministic Node tests that a valid V1 document round-trips with ids, `parentId`, order, `priority`, `done` and `note` unchanged and that `parseDocument` still accepts the result.
- [ ] 1.3 Implement pure mutation planners for create/rename subject, add/edit/complete step, add substep, promote, reorder top-level and substep, remove and restore removal, each returning only the affected per-record put/delete operations; verify with deterministic Node tests, per operation, that only the affected records change, that the `id`, `parentId`, order and `note` invariants hold, and that no planner returns a whole-document replacement.
- [ ] 1.4 Extend the `package.json` `check` script to `node --check` the new `site/persistence.js` module; verify with a deterministic assertion that the module is covered and that `node --check site/persistence.js` exits successfully.

## 2. Transactional adapter and failure semantics

- [ ] 2.1 Implement the injectable `commit(operations)` store adapter contract plus an in-memory fake store used by the tests; verify with deterministic Node tests that a successful commit reports the mutation as recorded locally, applies the fake-store change, and performs no network call.
- [ ] 2.2 Report an IndexedDB transaction failure as an unsaved local error and a later synchronization failure as a distinct kind; verify with deterministic Node tests that a forced commit failure rejects with the local kind, leaves the fake store unchanged and never reports success, and that the local and synchronization kinds differ.
- [ ] 2.3 Confirm a local mutation on commit without awaiting any network acknowledgement and keep the local confirmation following a synchronization error; verify with deterministic Node tests, using a fake store with no network, that the mutation is recorded and that a simulated synchronization error does not retract the recorded status.

## 3. Multi-tab coherence and fine-grained concurrency

- [ ] 3.1 Implement a change-subscription contract used to propagate committed changes and refresh another consumer's projection; verify with deterministic Node tests using two in-memory stores and subscribers that a commit in one is observed by the other with no browser `storage` event involved.
- [ ] 3.2 Ensure independent edits to distinct steps do not overwrite each other; verify with deterministic Node tests that a step edited in one consumer and another step edited in a second consumer both remain after propagation, and that no emitted operation set rewrites an unaffected record.

## 4. JSON V1 import/export and preference separation

- [ ] 4.1 Apply a valid JSON V1 import as one atomic operation set through the adapter; verify with deterministic Node tests that the imported document replaces the local records, round-trips through the projection and is emitted as a single operation set.
- [ ] 4.2 Reject an invalid JSON V1 import without changing local records; verify with deterministic Node tests that a rejected import leaves the fake store identical to before and reports the validation error.
- [ ] 4.3 Keep the tracked-action preference and other UI-only preferences in origin-scoped non-synchronized storage; verify with deterministic Node tests and static assertions that the preference key is absent from the synchronized records and from the exported JSON.

## 5. Application wiring, purity and compatibility guard

- [ ] 5.1 Route the `site/app.js` business mutations through the injected transactional adapter while keeping `site/core.js` pure; verify with deterministic static assertions that `core.js` contains no `fetch`, `XMLHttpRequest`, `localStorage`, `indexedDB` or DOM primitive and that the business mutations call the adapter.
- [ ] 5.2 Subscribe the application to committed changes through the Dexie change mechanism and/or a broadcast channel rather than only the `storage` event; verify with deterministic static assertions that the subscription is present and that the `storage` listener is not the sole propagation path.
- [ ] 5.3 Add a non-destructive compatibility guard that keeps the historical `threadstep.document.v1` document available and never erases or destructively rewrites it before the explicit conversion; verify with deterministic Node tests that the guard preserves the historical document and with static assertions that no code path deletes it or transfers it unsafely.
- [ ] 5.4 Update `docs/product/developer-guide.md` and `docs/product/mvp.md` to describe the transactional adapter, the fine-grained entities and the compatibility guard; verify with deterministic assertions that the new text is present, that the local-first evolution note is reconciled and that `npm run backlog:check` still passes.

## 6. Integration checks

- [ ] 6.1 Run `npm run check`; report the exact command and its real output, and do not mark earlier tasks complete if it fails.
- [ ] 6.2 Run `openspec validate ts-025 --strict --no-interactive` and `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-025/tasks.md`; report the exact commands and their real output, and do not mark earlier tasks complete if either fails.

## Manual acceptance

- On a real desktop and mobile browser, exercise the migrated business operations end to end after a valid session: create and rename a subject, add, edit, complete and remove a step, add and promote a substep, reorder a top-level step and a substep, undo a removal, toggle the completed filter, and check the counter, the suggestion, the tracking and the routes; confirm each change is reflected after a reload.
- Against an isolated test Dexie Cloud instance and an authorized Pages origin, verify that an offline write after initialization is confirmed locally without a network acknowledgement, that the interface shows local recording distinct from synchronization, and that a forced IndexedDB failure (for example blocked or full storage) is reported as a local error, never as a success and never as a network error.
- Open the app in two tabs or two devices of the same origin, commit independent changes in each, and confirm both converge to a coherent state and that independent edits to distinct steps are not overwritten.
- Exercise the JSON export and import flow in the browser with a real file, including an invalid import, and confirm atomicity and the preserved V1 shape, order, notes and hierarchy.
- Confirm the compatibility guard: existing V1 data stays visible and usable and is not erased or transferred without consent during this transitional change.
- Navigate with the keyboard alone, check focus and live-region announcements, touch targets and the mobile layout, and check screen-reader output where possible.
- These are pending human acceptance, not completed by any green Node test, and contain no checkbox.

## Post-sync review

- After the separate OPSX semantic sync step, compare the canonical delta for `local-first-business-persistence` (ADDED) against the intended behavior and confirm that no other requirement changed.
- Check the archived OpenSpec change and its versioned content.
- After the PR is published, verify the independent GitHub `check` job on the exact head SHA, the required branch protection, the merge evidence and the post-merge CI / GitHub Pages deployment.
- This stage is external to `apply`; these reviews contain no checkbox and must never be marked complete before their evidence exists.
