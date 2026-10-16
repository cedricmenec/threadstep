# Tasks

## 1. Pure priority helper and deterministic tests in `site/core.js`

- [ ] 1.1 Add `setItemPriority(document, subjectId, itemId, priority)` to
  `site/core.js`. Validate the document, the subject and the item; accept only
  `PRIORITIES` values; return the same document reference for a missing subject
  or item, an invalid priority, or a priority equal to the current one; otherwise
  return a new document whose only change is the targeted item's `priority`,
  preserving `id`, `title`, `done`, `parentId`, subject membership and every other
  item. Verify with `node --check site/core.js`.
- [ ] 1.2 Add deterministic `tests/core.test.mjs` cases proving all three allowed
  values are accepted and an unknown value such as `"demain"` is rejected. Verify
  with `npm test`.
- [ ] 1.3 Add deterministic cases proving every no-op path returns the identical
  reference (same priority, missing subject, missing item, invalid priority) and
  that the input document, subjects, items and arrays are never mutated. Verify
  with `npm test`.
- [ ] 1.4 Add deterministic cases proving immutability of the other properties:
  `id`, `title`, `done`, `parentId` and every unrelated item are byte-identical
  after a change, for both a top-level action and a one-level substep, and that a
  substep's parent and siblings are untouched. Verify with `npm test`.
- [ ] 1.5 Add deterministic cases proving the changed item is re-grouped by
  `sortedItems` / `visibleItems` in the urgent → normal → later order while the
  relative order of the unaffected items inside each group is preserved. Verify
  with `npm test`.
- [ ] 1.6 Add deterministic cases proving a changed document round-trips through
  `parseDocument` and that `updateItem`, `reorderWithinPriority` and
  `moveWithinPriority` behavior is unchanged (non-regression). Verify with
  `npm test`.

## 2. Interactive badge control in `site/app.js`

- [ ] 2.1 Replace the decorative badge in `renderRow` with a French interactive
  priority control that keeps the current value visible, offers exactly Urgent,
  Normal and Plus tard, carries an accessible name naming the item title and its
  current priority, and updates the `priority-<value>` class. Render it for both a
  top-level action and a one-level substep. Verify with `node --check site/app.js`
  and by inspecting an action and a substep.
- [ ] 2.2 Wire the control's change to `setItemPriority`: on a real change only,
  replace `documentState`, persist exactly once and announce a short French
  message; on the same value or a close without selection, write nothing. Verify
  by reading the localStorage value before and after, and by re-selecting the
  current priority.
- [ ] 2.3 Add a deferred focus target (a `pendingPriorityFocus` flag consumed by
  `applyFocus()`) so the re-rendered priority control of the same item regains
  focus after a change, keeping Tab, Enter, Space and Escape usable. Verify by
  keyboard on an action and on a substep.
- [ ] 2.4 Confirm activating the control starts no drag and triggers no
  completion toggle, substep collapse, removal or title editing, and that those
  controls still work as before. Verify manually with mouse and touch.

## 3. Styles for the interactive priority control

- [ ] 3.1 Update `site/styles.css` so the control keeps the Urgent / Normal /
  Plus tard badge look while providing a touch target of at least 44 × 44 px, a
  visible focus state and no non-essential animation outside
  `@media (prefers-reduced-motion: no-preference)`. Verify by inspecting the
  computed styles.
- [ ] 3.2 Verify at a narrow viewport and with `prefers-reduced-motion` enabled
  that the control stays comfortably tappable and the `.task-row` wraps without
  overlap. Verify visually.

## 4. Product documentation

- [ ] 4.1 Update `docs/product/guide-utilisation.md` with a section describing the
  interactive priority badge on actions and substeps: the three choices, the
  current-value indication, the immediate local save, the no-op behavior and the
  re-grouping. Verify the text matches the shipped UI.
- [ ] 4.2 Update `docs/product/mvp.md` with FR-18 and a matching acceptance test,
  and note that the full « Modifier » editor, the counter, the suggestion, the
  tracking and the ordering behavior are unaffected. Verify the text matches the
  shipped behavior and that no workflow, `AGENTS.md`, `backlog/` or
  `docs/factory/` file changed.

## 5. Integration verification

- [ ] 5.1 Run `npm run check` and report the exact command and its output.
- [ ] 5.2 Run `openspec validate ts-015 --strict --no-interactive` and report the
  exact command and its output.
- [ ] 5.3 Confirm the delta under `openspec/changes/ts-015/specs/` contains only
  the expected `## ADDED Requirements` for `action-editing`, that no canonical
  spec under `openspec/specs/` was edited during implementation, and that no new
  storage key, field or document version was introduced.
- [ ] 5.4 Confirm a priority change survives a reload and an export followed by an
  import, and that `git status` shows no protected path changed.

## Post-sync review

- After the OpenCode OPSX sync, diff `openspec/specs/action-editing/spec.md`
  against its delta and confirm the new requirements and scenarios were appended
  without loss, duplication or rewording, and that the strict description-length
  check passes.
- Confirm that `action-ordering/spec.md`, `action-removal/spec.md`,
  `next-action-suggestion/spec.md`, `resume-tracking/spec.md`,
  `substep-collapse/spec.md` and `substep-ordering/spec.md` are byte-identical to
  their prior canonical revisions, since this change only ADDS requirements to
  `action-editing`.
- Verify the OPSX content-scope guard, the OpenSpec archive step and the
  independent PR CI `check`. A reviewer must approve the semantic diff before
  merge.
- Verify the GitHub Pages deployment and manually test the badge with a finger, at
  the keyboard and with a screen reader; confirm no new browser-storage key
  appears.
- These assertions cannot be checked by apply before sync has run.

## Workflow follow-up

- Do not archive during implementation; sync and archive only through the
  project's reviewed process after every tracked task is checked and strict
  validation passes.
- Confirm no protected path (`AGENTS.md`, workflows, `backlog/*`,
  `docs/factory/*`, `opencode.json`, config, secrets) changed and that independent
  CI passes before merge.
- This plan authorizes no paid model run, no apply, no merge and no archive.
