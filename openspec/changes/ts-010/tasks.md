# Tasks

## 1. Pure removal and restore helpers in `site/core.js`

- [ ] 1.1 Add `planRemoval(document, subjectId, itemId)` returning
  `{ document, removal }`: on a no-op (missing subject or item) return the same
  document reference and `removal: null`; otherwise return a new document without
  the target and, for a top-level target, all items whose `parentId === itemId`,
  plus a receipt `{ subjectId, rootId, entries }` with `entries` as
  `[{ index, item }]` in ascending original-index order and `item` a shallow copy.
  Never mutate the input. Verify with `node --check site/core.js`.
- [ ] 1.2 Add `restoreRemoval(document, removal)` re-inserting each entry at
  `Math.min(index, length)`, skipping ids already present, returning the same
  reference for a null/invalid receipt, a missing subject, or nothing to insert,
  and never recreating a removed subject. Add `removalContainsItem(removal,
  itemId)`. Verify with `node --check site/core.js`.
- [ ] 1.3 Add unit tests in `tests/core.test.mjs` proving `planRemoval` removes a
  top-level action with all its substeps and a single substep without touching its
  siblings, persists the order change in the returned document, returns the same
  reference and `removal: null` for a missing subject/item, and never mutates or
  shares references with the input. Verify with `npm test`.
- [ ] 1.4 Add unit tests proving `restoreRemoval` rebuilds the exact subtree —
  same `id`, title, priority, `done`, `parentId` and original order — round-trips
  `planRemoval` → `restoreRemoval` to a deep-equal document, preserves items added
  or edited before the undo, returns the same reference when the subject is
  missing (never recreating it), and that `removalContainsItem` is true for the
  target and its substeps and false for unrelated items. Verify with `npm test`.

## 2. Removal and undo wiring in `site/app.js`

- [ ] 2.1 Add `pendingRemoval` state and an `invalidatePendingRemoval()` helper
  that clears the timer, hides the snackbar and resets the state. Verify by
  inspecting the module after `node --check site/app.js` and by manual behavior.
- [ ] 2.2 Replace the inline remove handler in `renderActions` with a
  `retirerAction(subject, item)` that calls `planRemoval`, captures the live
  `resumeRef` into `pendingRemoval.trackedRef` when
  `removalContainsItem(removal, resumeRef.itemId)`, sets
  `focusSubjectId = subject.id`, persists immediately, then shows the snackbar and
  starts the 10-second timer; no `confirm()` is added. Verify that a click removes
  the item and its substeps at once, saves to `threadstep.document.v1` and shows
  « Étape retirée » with « Annuler ».
- [ ] 2.3 Implement the snackbar content and the cancellable timer: one
  `setTimeout` with a deadline and remaining time, `suspend`/`resume` on
  `focusin`/`focusout` inside the snackbar, auto-hide at expiry, and a guard so an
  « Annuler » activation after expiry restores nothing. Verify there is no polling
  and no network call, and that an unrelated re-render keeps the window.
- [ ] 2.4 Wire « Annuler » to `restoreRemoval`, persist again, set
  `focusItemId`/`revealItemId` to the restored root, clear the pending state and
  hide the snackbar. Verify the restored action and substeps return to their
  positions, a fresh export contains them, and a click after expiry does nothing.
- [ ] 2.5 Make a new removal replace the previous window by calling
  `invalidatePendingRemoval()` first, and call it after a successful import, in
  the `storage` event handler before `load()`, and in the whole-subject delete
  handler after its confirmation. Verify a second removal replaces the snackbar,
  only the last removal is restorable, and import / subject deletion / external
  update discard a pending undo without recreating data.

## 3. Accessible, mobile-safe snackbar

- [ ] 3.1 Add a `#snackbar` region to `site/index.html` (`role="status"`,
  `aria-live="polite"`, `hidden`) placed outside `#subjects` and outside the
  regions `render()` clears, and give the « Annuler » button an accessible French
  name naming the removed step. Verify the message is announced and the button has
  an accessible name.
- [ ] 3.2 Add `site/styles.css` rules for a fixed bottom snackbar that respects
  the mobile safe area (`env(safe-area-inset-bottom)`), keeps a comfortable touch
  target, and disables non-essential animation under `prefers-reduced-motion`.
  Verify at a narrow viewport that it stays visible above the safe area without
  permanently covering the lists.
- [ ] 3.3 Verify keyboard behavior manually: removal never loses focus (focus
  moves to the originating subject card), undo focuses the restored action's
  « Modifier » control, the countdown pauses while focus is inside the snackbar
  and resumes after, and a removed title containing markup such as
  `<img src=x onerror=alert(1)>` is rendered literally.

## 4. « Je reprends ici » coherence

- [ ] 4.1 Add a pure `restorableTrackingRef(document, trackedRef)` to
  `site/core.js` returning `trackedRef` only when `resumeView` resolves it, else
  `null`, and unit tests covering a valid unfinished top-level action, a missing
  action, a completed action and a substep. Verify with `npm test`.
- [ ] 4.2 In `site/app.js`, null `pendingRemoval.trackedRef` on any explicit
  tracking change (pin or clear) while a removal is pending, and on undo re-set
  `resumeRef` and rewrite `RESUME_KEY` only when `restorableTrackingRef` returns a
  reference. Verify that removing the tracked action clears its reference as
  today, undoing without another choice restores the card, and choosing another
  action first prevents any restoration.

## 5. Product documentation

- [ ] 5.1 Update `docs/product/mvp.md` (FR-02 and the acceptance tests) to
  describe the delivered behavior: immediate persistent removal, a 10-second
  local non-modal undo inserted into the existing `threadstep.document.v1`
  document, exact subtree restoration, invalidation on subject removal/import/
  external update, no reload restore and no new key. Verify the text matches the
  shipped UI and that no `docs/factory/` file, workflow, config or backlog file
  was changed.

## 6. Integration verification and delta scope

- [ ] 6.1 Verify coherence observably: after a removal and after an undo, the
  pending count, the completed-items filter, the TS-007 suggestion and a JSON
  export/import round-trip all reflect the current document, and the document
  keeps its version 1 and `threadstep.document.v1` key with no extra key created.
- [ ] 6.2 Confirm whole-subject deletion and import keep their existing
  `confirm()` dialogs and offer no snackbar, and that the only new in-memory state
  is `pendingRemoval` with no persistence across reload.
- [ ] 6.3 Run `npm run check` and
  `openspec validate ts-010 --strict --no-interactive`, report the exact commands
  and their output, and confirm the delta files under
  `openspec/changes/ts-010/specs/` contain only the intended
  `## ADDED Requirements` for `action-removal` and `## MODIFIED Requirements`
  for the single `Automatic cleanup` requirement of `resume-tracking`, with the
  existing scenarios preserved and no other requirement changed.

## Post-sync review

- After the OpenCode OPSX sync, diff `openspec/specs/action-removal/spec.md`
  (new) and `openspec/specs/resume-tracking/spec.md` (modified) against their
  previous canonical revisions. Confirm the new capability is created with its
  `## Purpose`, that only `Automatic cleanup` changed in `resume-tracking`, that
  every preserved scenario is byte-identical, and that no requirement or scenario
  was duplicated or dropped.
- Verify the OPSX content-scope guard, the OpenSpec archive and the independent
  PR CI `check`. A reviewer must approve the semantic diff before merge.
- Verify the GitHub Pages deployment and manually check the touch experience on a
  mobile viewport and the keyboard/focus experience.
- These post-sync assertions cannot be ticked by apply before sync has run.

## Workflow follow-up

- Do not archive during implementation; sync and archive only through the
  project's reviewed process after every tracked task is checked and validation
  is strict.
- Confirm no protected path (`AGENTS.md`, workflows, `backlog/*`,
  `docs/factory/*`, `opencode.json`, config, secrets) changed and that independent
  CI passes before merge.
- This plan authorizes no paid model run, no apply, no merge and no archive.
