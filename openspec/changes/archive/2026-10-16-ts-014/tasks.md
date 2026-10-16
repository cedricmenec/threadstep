# Tasks

## 1. Generalised pure ordering helpers and tests in `site/core.js`

- [x] 1.1 Widen `reorderWithinPriority(items, itemId, targetId, position)` so a
  group is identified by the source's `parentId` **and** `priority` instead of
  top-level only: keep the existing name and signature, validate that both ids
  exist, are distinct, share a `parentId` and a `priority` and that `position` is
  `"before"` or `"after"`, and otherwise return the same array reference;
  reorder only that group's items and write them back into their original
  physical slots. Verify with `node --check site/core.js`.
- [x] 1.2 Widen `moveWithinPriority(items, itemId, direction)` to move by one
  rank inside the same `(parentId, priority)` group, and keep
  `canReorderWithinPriority` / `canMoveWithinPriority` as the derived predicates.
  Verify with `node --check site/core.js`.
- [x] 1.3 Add deterministic `tests/core.test.mjs` cases for a valid substep
  reorder inside one parent+priority group (before and after), the adjacent
  up/down move, and first/last boundaries returning the same reference. Verify
  with `npm test`.
- [x] 1.4 Add deterministic cases for every refusal: substep to another parent,
  another priority, a top-level action, the same id, a missing id, an unchanged
  position and an invalid `position` all return the same reference; the input
  array and its objects are never mutated. Verify with `npm test`.
- [x] 1.5 Add deterministic cases proving an interleaved array only changes the
  target group, that other parents, top-level actions and subjects keep their
  data and order, that a reordered document round-trips through `parseDocument`,
  and that the existing top-level behavior is unchanged. Verify with `npm test`.

## 2. Substep handle and move controls in `site/app.js`

- [x] 2.1 Remove the `parentId === null` restriction around the reorder controls
  in `renderActions` so every item renders a handle and « Monter » / « Descendre
  », while the top-level markup and behavior stay identical. Verify with
  `node --check site/app.js` and by inspecting the rendered controls in the
  browser.
- [x] 2.2 Build French accessible names for substep controls that contain the
  substep title, its priority and its parent action (for example
  `"Monter « sous-tâche » (sous-étape de « parent », priorité Normal)"`), rendered
  as text only, and keep the existing top-level names unchanged. Verify by
  inspecting the accessible names of a singular substep and a top-level action.
- [x] 2.3 Wire the substep move buttons to `moveWithinPriority`, replace the
  subject's `items` order, persist exactly once, set the deferred
  `pendingMoveFocus` consumed by `applyFocus()` and announce the move through the
  existing French live region. Verify by keyboard: activate a move, confirm the
  new order, the announcement and that focus stays usable.
- [x] 2.4 Confirm a substep move control performs the same adjacent-rank change
  as a one-rank substep drag and never changes a priority. Verify by comparing
  both operations on the same document and reading the priority badges.

## 3. Substep drag-and-drop, cancellation and top-level regression in `site/app.js`

- [x] 3.1 Confirm the existing pointer pipeline drags a substep handle as well as
  a top-level handle, that `resolveDropTarget` offers only sibling substeps of the
  same parent and priority through `canReorderWithinPriority`, and that a valid
  drop persists once. Verify with a mouse and by inspecting the stored document.
- [x] 3.2 Confirm `Escape`, `pointercancel`, a lost pointer capture and releasing
  over an invalid target clear the drag state and save nothing, and that the page
  still scrolls normally outside the handle. Verify with a mouse and a touch
  device.
- [x] 3.3 Confirm activating « Modifier », « Retirer », the completion checkbox
  or « Garder le fil » never starts a drag, that a top-level drag and its
  accessible names stay identical, and that a drop on a parent row, another
  parent's child, another priority or empty space changes no document data and
  writes no storage. Verify manually and by reading the final localStorage value
  after each refusal.

## 4. Filter, collapse and coherence

- [x] 4.1 When `hideCompleted` is true, render no substep handle, disable the
  substep move controls and show the existing French `#reorder-note` explanation;
  re-displaying steps restores the controls with the stored order unchanged.
  Verify manually by toggling the filter.
- [x] 4.2 Confirm a collapsed parent exposes no substep handle or move control
  and cannot receive an invisible substep drop, and that expanding restores the
  substeps in the same stored order and states. Verify by collapsing and
  expanding a parent with mixed priorities.
- [x] 4.3 Verify observable coherence after a substep reorder: the pending
  counter, the deterministic suggestion, the « Je reprends ici » tracking, the
  removal undo and the TS-012/TS-013 collapse label all follow the current
  document, and no id, title, priority, `done` flag or `parentId` changes. Verify
  by diffing the exported JSON before and after a reorder.

## 5. Styles for substep reorder controls

- [x] 5.1 Confirm or adjust `site/styles.css` so the nested substep handle and
  move controls keep a touch target of at least 44 × 44 px, the dragged row and
  valid-drop indicators stay visible inside `ul.tasks.children`, and any
  animation stays inside a `prefers-reduced-motion: no-preference` guard. Verify
  by inspecting the computed styles.
- [x] 5.2 Verify at a narrow viewport and with `prefers-reduced-motion` enabled
  that the substep handle stays comfortably tappable, the drop hint stays
  readable, the page scrolls outside the handle and no non-essential animation
  plays.

## 6. Product documentation

- [x] 6.1 Update `docs/product/guide-utilisation.md` with a section describing
  substep reordering: the handle and « Monter » / « Descendre » for the direct
  substeps of one parent and one priority, the refused cross-parent and
  cross-priority drops, the suspension under « Masquer les étapes terminées » and
  the collapsed-parent behavior. Verify the text matches the shipped UI.
- [x] 6.2 Update `docs/product/mvp.md` with a new functional requirement (FR-17)
  and a matching acceptance test for same-parent, same-priority substep
  ordering, and note that the pending counter, suggestion and tracking are
  unaffected. Verify the text matches the shipped behavior and that no workflow,
  `AGENTS.md`, `backlog/` or `docs/factory/` file changed.

## 7. Integration verification

- [x] 7.1 Run `npm run check` and report the exact command and its output.
- [x] 7.2 Run `openspec validate ts-014 --strict --no-interactive` and report the
  exact command and its output.
- [x] 7.3 Confirm the deltas under `openspec/changes/ts-014/specs/` contain only
  the expected `## ADDED Requirements` for `substep-ordering` and `## MODIFIED
  Requirements` for `action-ordering`, that no canonical spec under
  `openspec/specs/` was edited during planning, and that the implementation adds
  no second nesting level and no re-parenting path.
- [x] 7.4 Confirm the substep order survives a reload and an export followed by
  an import, that no browser-storage key beyond the existing document and resume
  keys is created, and that no protected path changed. Verify with the export
  button, the browser storage inspector and `git status`.

## Post-sync review

- After the OpenCode OPSX sync, diff `openspec/specs/substep-ordering/spec.md`
  against its delta and confirm the `## Purpose`, requirements and scenarios were
  copied without loss, duplication or rewording, and that the strict
  description-length check passes.
- Diff `openspec/specs/action-ordering/spec.md` against its modified delta and
  confirm only the two scoped requirements changed, with every other requirement
  and scenario intact.
- Confirm that `action-editing/spec.md`, `action-removal/spec.md`,
  `next-action-suggestion/spec.md`, `resume-tracking/spec.md` and
  `substep-collapse/spec.md` are byte-identical to their prior canonical
  revisions, since this change only adds `substep-ordering` and scopes
  `action-ordering`.
- Verify the OPSX content-scope guard, the OpenSpec archive step and the
  independent PR CI `check`. A reviewer must approve the semantic diff before
  merge.
- Verify the GitHub Pages deployment and manually test the substep handle with a
  finger on a smartphone, at the keyboard, and confirm no new browser-storage key
  appears.
- These assertions cannot be ticked by apply before sync has run.

## Workflow follow-up

- Do not archive during implementation; sync and archive only through the
  project's reviewed process after every tracked task is checked and strict
  validation passes.
- Confirm no protected path (`AGENTS.md`, workflows, `backlog/*`,
  `docs/factory/*`, `opencode.json`, config, secrets) changed and that
  independent CI passes before merge.
- This plan authorizes no paid model run, no apply, no merge and no archive.