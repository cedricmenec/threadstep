# Tasks

## 1. Pure collapse-label helper in `site/core.js`

- [x] 1.1 Add `substepToggleLabel(visibleCount, collapsed)` returning
  « Masquer les sous-tâches » when not collapsed, « Voir 1 sous-tâche » when
  collapsed with exactly one visible substep, and « Voir N sous-tâches » when
  collapsed with N > 1; it must be pure, never throw for 0 or non-numeric input
  and never mutate anything. Verify with `node --check site/core.js`.
- [x] 1.2 Add deterministic tests in `tests/core.test.mjs` asserting the exact
  strings for the expanded label, the singular case and several plural cases.
  Verify with `npm test`.
- [x] 1.3 Add deterministic tests deriving the count from
  `substepView(items, parentId, hideCompleted, collapsedIds).children.length`:
  three direct substeps with one completed give 3 without the filter and 2 with
  it, and the label for those counts is exact. Verify with `npm test`.
- [x] 1.4 Add deterministic tests that computing the view and the label never
  mutates the `items` array, its objects or the collapsed `Set`. Verify with
  `npm test`.

## 2. Label and accessible name in `site/app.js`

- [x] 2.1 In `renderSubstepToggle`, replace the hardcoded « Déplier » / « Replier »
  text with `substepToggleLabel(view.children.length, view.collapsed)`, keeping
  the native `button type="button"`, `aria-expanded` from `view.collapsed` and
  `aria-controls` while `view.renderChildren` is true. Verify with
  `node --check site/app.js` and by inspecting the rendered markup in both
  states.
- [x] 2.2 Build the accessible name from the same label plus the parent title
  (for example `label + " de « " + item.title + " »"`), rendered as text only,
  so it contains the current label and names the parent action. Verify by
  inspecting the accessible name for a singular, a plural and an expanded state.
- [x] 2.3 Confirm the click handler still calls `toggleCollapsedParent`, sets
  `pendingCollapseFocus` and calls `render()` without `persist()`, so no storage
  write, no document mutation and focus continuity are unchanged. Verify with
  the keyboard (Tab to the control, activate with Enter) and by checking that
  `threadstep.document.v1` is not rewritten and no new storage key appears.
- [x] 2.4 Confirm the label refreshes on the next render after a direct substep
  is added, removed, restored, completed or filtered, that a parent whose
  substeps are all hidden by the filter shows no control, and that another
  parent's collapse state is untouched. Verify by inspecting the rendered DOM
  and the label text across those operations.

## 3. Product documentation

- [x] 3.1 Update `docs/product/guide-utilisation.md` so the TS-012 section
  describes the new labels: « Voir 1 sous-tâche », « Voir N sous-tâches » when
  collapsed and « Masquer les sous-tâches » when expanded, and states that the
  count follows the « Masquer les étapes terminées » filter. Verify the text
  matches the shipped UI.
- [x] 3.2 Update `docs/product/mvp.md` FR-16 (and the matching acceptance test)
  to describe the count label and the accessible name containing the label and
  the parent title. Verify the text matches the shipped behavior and that no
  workflow, `AGENTS.md`, `backlog/` or `docs/factory/` file changed.

## 4. Integration verification

- [x] 4.1 Run `npm run check` and report the exact command and its output.
- [x] 4.2 Run `openspec validate ts-013 --strict --no-interactive` and report the
  exact command and its output.
- [x] 4.3 Confirm the delta under
  `openspec/changes/ts-013/specs/substep-collapse/` contains only the expected
  `## MODIFIED Requirements` and `## ADDED Requirements`, that no canonical spec
  under `openspec/specs/` was edited during planning, and that the implementation
  adds no second control, no nesting level and no persistence.
- [x] 4.4 Diff the exported JSON and the `threadstep.document.v1` value before and
  after collapsing and expanding a parent: ids, titles, priorities, completion
  flags, parent relations and item order are identical, the version stays 1 and no
  browser-storage key beyond the existing document and resume keys is created.
  Verify with the export button and the browser storage inspector.

## Post-sync review

- After the OpenCode OPSX sync, diff the new
  `openspec/specs/substep-collapse/spec.md` against the delta and confirm the
  modified requirements and the new count requirements were applied without loss,
  duplication or rewording, and that the description-length strict check passes.
- Confirm that `action-editing/spec.md`, `action-ordering/spec.md`,
  `action-removal/spec.md`, `next-action-suggestion/spec.md` and
  `resume-tracking/spec.md` are byte-identical to their prior canonical
  revisions, since this change only touches `substep-collapse`.
- Verify the OPSX content-scope guard, the OpenSpec archive and the independent
  PR CI `check`. A reviewer must approve the semantic diff before merge.
- Verify the GitHub Pages deployment and manually test the control with a finger
  on a smartphone, at the keyboard, the singular/plural texts, the filter count
  and that no new browser-storage key appears.
- These post-sync assertions cannot be ticked by apply before sync has run.

## Workflow follow-up

- Do not archive during implementation; sync and archive only through the
  project's reviewed process after every tracked task is checked and strict
  validation passes.
- Confirm no protected path (`AGENTS.md`, workflows, `backlog/*`,
  `docs/factory/*`, `opencode.json`, config, secrets) changed and that
  independent CI passes before merge.
- This plan authorizes no paid model run, no apply, no merge and no archive.
