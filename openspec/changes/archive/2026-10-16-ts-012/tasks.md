# Tasks

## 1. Pure substep visibility and expansion helpers in `site/core.js`

- [x] 1.1 Add `substepView(items, parentId, hideCompleted, collapsedIds)`
  returning `{ children, hasVisibleSubsteps, collapsed, renderChildren }`, where
  `children = visibleItems(items, parentId, hideCompleted)`,
  `hasVisibleSubsteps = children.length > 0`,
  `collapsed = hasVisibleSubsteps && collapsedIds instanceof Set &&
  collapsedIds.has(parentId)` and `renderChildren = hasVisibleSubsteps &&
  !collapsed`; a missing parent yields an empty non-collapsed view. Verify with
  `node --check site/core.js` and the new unit tests.
- [x] 1.2 Add `toggleCollapsedParent(collapsedIds, parentId)` returning a new
  `Set` with the id added or removed and never mutating the input (a non-Set
  input is treated as empty). Verify with `node --check site/core.js` and unit
  tests.
- [x] 1.3 Add deterministic tests in `tests/core.test.mjs`: a parent with
  children reports `hasVisibleSubsteps` and `renderChildren`; a parent without
  children reports neither; a substep id passed as parent reports none. Verify
  with `npm test`.
- [x] 1.4 Add deterministic tests: with a collapsed set, the target parent
  reports `collapsed` and `renderChildren === false` while a second parent stays
  expanded; toggling is independent per parent; the input `items` array and its
  objects and the input `Set` are never mutated. Verify with `npm test`.
- [x] 1.5 Add deterministic tests for the completion filter: with substeps
  partially completed only visible substeps are returned; when every substep is
  completed `hasVisibleSubsteps` is false and no control is implied. Verify with
  `npm test`.

## 2. Disclosure control, state and focus in `site/app.js`

- [x] 2.1 Add a tab-local `let collapsedParents = new Set();` and compute
  `substepView(subject.items, item.id, hideCompleted, collapsedParents)` in
  `renderItem`; render `ul.tasks.children` only when `renderChildren` is true and
  append `children` otherwise, and append nothing when it is false. Verify with
  `node --check site/app.js` and by inspecting the rendered DOM while toggling.
- [x] 2.2 In `renderActions`, when `item.parentId === null` and the parent has
  visible substeps, append a native `<button type="button" class="subtle
  task-toggle">` labelled « Replier » when expanded and « Déplier » when
  collapsed, with an accessible French name naming the action. Verify by
  inspecting the rendered markup and accessible name.
- [x] 2.3 Set `aria-expanded` to `"true"`/`"false"` from the current state and,
  only while the list is rendered, set `aria-controls` to that list's generated
  identifier; confirm no `aria-controls` remains while collapsed. Verify in the
  browser inspector for both states.
- [x] 2.4 Wire the click to `toggleCollapsedParent`, set
  `pendingCollapseFocus = item.id` and call `render()` without calling
  `persist()`; add a `pendingCollapseFocus` branch in `applyFocus()` that focuses
  the same action's `.task-toggle` and scrolls it into view. Verify by keyboard:
  Tab to the control, activate with Enter, and confirm focus stays on the control.
- [x] 2.5 Reset the collapsed set on a successful JSON import so that imported
  documents start expanded, and confirm activating the control performs no
  localStorage write and no document mutation. Verify by importing a document
  while a parent is collapsed.

## 3. Styles for the disclosure control

- [x] 3.1 Add `site/styles.css` rules for `.task-toggle` with a touch target of
  at least 44 × 44 px, the existing focus-visible treatment and any transition
  only inside a `prefers-reduced-motion: no-preference` guard. Verify by
  inspecting the computed width/height and by toggling `prefers-reduced-motion`.

## 4. Completion filter interaction and business-rule coherence

- [x] 4.1 With « Masquer les étapes terminées » active and a parent that has one
  completed and one unfinished substep, expand the parent and confirm only the
  unfinished substep is shown; confirm that a parent whose substeps are all
  hidden by the filter shows no control and that other parents keep their
  collapse setting. Verify manually and by reading the rendered DOM.
- [x] 4.2 Confirm the pending counter, the deterministic suggestion, the
  « Je reprends ici » tracking, priority sorting, editing, completion, the
  reorder controls, removal and undo behave exactly as before while a parent is
  collapsed, and that hidden substeps are still counted and removed with their
  parent. Verify manually across those controls.
- [x] 4.3 Diff the exported JSON and the `threadstep.document.v1` value before
  and after a simple collapse/expand: ids, titles, priorities, completion flags,
  parent relations and item order are identical, the version stays 1 and no
  browser-storage key beyond the existing document and resume keys is created.
  Verify with the export button and the browser storage inspector.

## 5. Product documentation

- [x] 5.1 Update `docs/product/guide-utilisation.md` with the French
  « Replier » / « Déplier » gesture, its temporary tab-local scope (reset after
  reload, new tab or import) and its interaction with « Masquer les étapes
  terminées ». Verify the text matches the shipped UI.
- [x] 5.2 Update `docs/product/mvp.md` with a functional requirement for the
  accessible, transient, per-parent substep disclosure and a matching acceptance
  test. Verify the text matches the shipped behavior and that no workflow,
  `AGENTS.md`, `backlog/` or `docs/factory/` file changed.

## 6. Integration verification

- [x] 6.1 Run `npm run check` and report the exact command and its output.
- [x] 6.2 Run `openspec validate ts-012 --strict --no-interactive` and report the
  exact command and its output.
- [x] 6.3 Confirm the delta under
  `openspec/changes/ts-012/specs/substep-collapse/` contains only
  `## ADDED Requirements`, that no canonical spec under `openspec/specs/` was
  edited during planning, and that the implementation adds no cross-parent,
  nested-level or persistent collapse path.
- [x] 6.4 Confirm the collapse survives ordinary operations (completion, filter
  toggle, edit, reorder) and that a reload, a new tab and an import start
  expanded. Verify in the browser.

## Post-sync review

- After the OpenCode OPSX sync, diff the new `openspec/specs/substep-collapse/spec.md`
  against the delta and confirm its `## Purpose`, requirements and scenarios were
  copied without loss, duplication or rewording.
- Confirm that `action-editing/spec.md`, `action-ordering/spec.md`,
  `action-removal/spec.md`, `next-action-suggestion/spec.md` and
  `resume-tracking/spec.md` are byte-identical to their prior canonical
  revisions, since this change only adds a capability.
- Verify the OPSX content-scope guard, the OpenSpec archive and the independent
  PR CI `check`. A reviewer must approve the semantic diff before merge.
- Verify the GitHub Pages deployment and manually test the control with a finger
  on a smartphone, at the keyboard, that the exported JSON is unchanged and that
  no new browser-storage key appears.
- These post-sync assertions cannot be ticked by apply before sync has run.

## Workflow follow-up

- Do not archive during implementation; sync and archive only through the
  project's reviewed process after every tracked task is checked and strict
  validation passes.
- Confirm no protected path (`AGENTS.md`, workflows, `backlog/*`,
  `docs/factory/*`, `opencode.json`, config, secrets) changed and that
  independent CI passes before merge.
- This plan authorizes no paid model run, no apply, no merge and no archive.
