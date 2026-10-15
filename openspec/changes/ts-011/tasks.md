# Tasks

## 1. Pure reordering helpers in `site/core.js`

- [ ] 1.1 Add `reorderWithinPriority(items, itemId, targetId, position)` (with
  `position` `"before"` or `"after"`): return the same array reference when the
  two ids are missing, equal, not both top-level (`parentId !== null`), or of
  different priorities, and when the resulting order is unchanged; otherwise
  return a shallow copy where only the target priority's top-level items are
  reordered and written back into their original physical slots, leaving every
  other index and object untouched. Verify with `node --check site/core.js` and
  the new unit tests.
- [ ] 1.2 Add `moveWithinPriority(items, itemId, direction)` built on the same
  primitive (one rank up/down inside the group), plus the predicates
  `canReorderWithinPriority(items, itemId, targetId, position)` and
  `canMoveWithinPriority(items, itemId, direction)`. Verify with
  `node --check site/core.js` and unit tests.
- [ ] 1.3 Add deterministic tests in `tests/core.test.mjs`: a valid move changes
  only that priority's order; up/down at the first/last of the group return the
  same reference; a different priority, a missing id and a substep id all return
  the same reference; the input array and item objects are never mutated and are
  not shared with the result. Verify with `npm test`.
- [ ] 1.4 Add deterministic tests: with an interleaved source array only the
  target group changes and other groups/subjects keep their data; a moved parent
  keeps ids, titles, priorities, flags, `parentId` and child order; a changed
  order makes `nextActionSuggestion` pick the earlier action in the new order; and
  `parseDocument(JSON.stringify(...))` round-trips the reordered document. Verify
  with `npm test`.

## 2. Monter/Descendre controls and focus in `site/app.js`

- [ ] 2.1 Render a handle and « Monter » / « Descendre » buttons only for
  top-level items (`parentId === null`) in `renderActions`, with accessible French
  names including the action title and its priority; compute `disabled` from
  `canMoveWithinPriority`. Verify with `node --check site/app.js` and by
  inspecting the rendered controls in the browser.
- [ ] 2.2 Wire the move buttons to `moveWithinPriority`, replace the subject's
  `items` order, persist exactly once, and set a deferred `pendingMoveFocus`
  (`{ itemId, direction }`) consumed by `applyFocus()` so focus returns to the
  moved action's control; announce the successful move through the existing
  `#status` live region. Verify by keyboard: activate a move, confirm the new
  order, the announcement and that focus stays usable.
- [ ] 2.3 Confirm a move control performs the same adjacent-rank change as a
  drag-and-drop of one rank, and never changes a priority. Verify by comparing
  both operations on the same document and inspecting the priority badges.

## 3. Drag-and-drop with Pointer Events in `site/app.js`

- [ ] 3.1 Implement pointer dragging from the handle only: `pointerdown` captures
  the pointer and records subject/item without mutating; `pointermove` resolves
  the candidate row with `document.elementFromPoint`, derives
  `{ targetId, position }` from the row's vertical midpoint, validates with
  `canReorderWithinPriority`, and shows an insertion indicator only on valid
  targets; `pointerup` applies `reorderWithinPriority`, persists once and moves
  focus. Verify with `node --check site/app.js` and manually with a mouse.
- [ ] 3.2 Handle cancellation: `Escape`, `pointercancel` and releasing outside a
  valid target clear the drag state and indicator and save nothing, and the page
  still scrolls normally outside the handle. Verify manually with a mouse and a
  touch device.
- [ ] 3.3 Confirm that activating « Modifier », « Retirer », « Garder le fil » or
  the completion checkbox never starts a drag, and that a drop on another
  priority, another subject, a substep or empty space changes no document data
  and writes no storage. Verify manually and by reading the final localStorage
  value after each refusal.

## 4. Filter suspension and coherence

- [ ] 4.1 When `hideCompleted` is true, render no handle, disable the move
  buttons and show a short French note near the filter explaining that all steps
  must be shown to reorganise; re-disabling the filter restores the controls with
  the stored order unchanged. Verify manually by toggling the filter.
- [ ] 4.2 Verify observable coherence after a reorder: the unfinished counter,
  the TS-007 suggestion (earlier action in the new order wins a same-priority
  tie), the TS-008 tracking (stable ids, card unchanged) and the TS-010 undo
  (restores the position recorded at removal) all follow the current document.
- [ ] 4.3 Confirm no id, title, priority, `done` flag or `parentId` changes, no
  new `order` field appears, the document version stays 1 and only
  `threadstep.document.v1` is written. Verify by diffing the exported JSON before
  and after a reorder.

## 5. Styles for handle, drop states and mobile

- [ ] 5.1 Add `site/styles.css` rules for a visible handle of at least 44 × 44 px
  with `touch-action:none`, for the dragged row and valid-drop/insertion states,
  and for a readable drop hint on a narrow viewport, with any animation inside a
  `prefers-reduced-motion: no-preference` guard. Verify by inspecting the
  computed styles.
- [ ] 5.2 Verify at a narrow viewport and with `prefers-reduced-motion` enabled
  that the handle stays comfortably tappable, the drop hint stays readable, the
  page scrolls outside the handle and no non-essential animation plays.

## 6. Product documentation

- [ ] 6.1 Update `docs/product/mvp.md` with a new functional requirement for
  manual within-priority ordering (drag handle plus Monter/Descendre, strict
  priority grouping, suspension under the completed filter, no schema change) and
  a matching acceptance test. Verify the text matches the shipped UI and that no
  workflow, config, `AGENTS.md`, `backlog/` or `docs/factory/` file changed.

## 7. Integration verification

- [ ] 7.1 Run `npm run check` and report the exact command and its output.
- [ ] 7.2 Run `openspec validate ts-011 --strict --no-interactive` and report the
  exact command and its output.
- [ ] 7.3 Confirm the delta under `openspec/changes/ts-011/specs/action-ordering/`
  contains only `## ADDED Requirements`, that no existing canonical spec was
  edited during planning, and that the tree contains no cross-subject or
  cross-priority reordering path.
- [ ] 7.4 Confirm the reorder survives a reload, an export followed by an import
  and that no browser-storage key beyond the existing document and resume keys is
  created.

## Post-sync review

- After the OpenCode OPSX sync, diff the new `openspec/specs/action-ordering/spec.md`
  against the delta and confirm its `## Purpose`, requirements and scenarios were
  copied without loss, duplication or rewording.
- Confirm that `openspec/specs/next-action-suggestion/spec.md`,
  `resume-tracking/spec.md` and `action-removal/spec.md` are byte-identical to
  their prior canonical revisions, since this change only adds a capability.
- Verify the OPSX content-scope guard, the OpenSpec archive and the independent
  PR CI `check`. A reviewer must approve the semantic diff before merge.
- Verify the GitHub Pages deployment and manually test the real drag gesture with
  a finger on a smartphone and with the keyboard before considering the
  experience validated.
- These post-sync assertions cannot be ticked by apply before sync has run.

## Workflow follow-up

- Do not archive during implementation; sync and archive only through the
  project's reviewed process after every tracked task is checked and validation
  is strict.
- Confirm no protected path (`AGENTS.md`, workflows, `backlog/*`,
  `docs/factory/*`, `opencode.json`, config, secrets) changed and that
  independent CI passes before merge.
- This plan authorizes no paid model run, no apply, no merge and no archive.
