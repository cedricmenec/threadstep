# Proposal

## Why

The TS-012 disclosure control (shipped by
[PR #55](https://github.com/cedricmenec/threadstep/pull/55)) collapses a parent's
substeps but its labels « Replier » / « Déplier » say nothing about how many
substeps are hidden. A user scanning a long subject cannot tell whether a
collapsed action hides one or five substeps, so the control is less informative
than it could be. TS-013 makes the collapsed label state the visible substep
count, e.g. « Voir 2 sous-tâches », with no new control, structure or data.

## What Changes

- Change **only the visible label** of the existing TS-012 disclosure button; no
  second control is created.
  - Collapsed with exactly one visible direct substep: « Voir 1 sous-tâche ».
  - Collapsed with N > 1 visible direct substeps: « Voir N sous-tâches ».
  - Expanded: « Masquer les sous-tâches ».
- Count the **direct visible substeps under the current « Masquer les étapes
  terminées » filter**, independent of whether those substeps are themselves
  collapsed. Example: three direct substeps, one completed, yield 3 without the
  filter and 2 with it.
- Keep the existing presence rule: no button when no substep is visible, and no
  button on a substep itself. Refresh the count on the next render after a
  substep is added, removed, restored, completed or filtered.
- Keep the accessible name including **the new label and the parent title**, the
  exact `aria-expanded`, the `aria-controls` reference while the list exists,
  coherent focus, mouse/touch/Tab/Enter/Space operation and the ≥ 44 × 44 px
  touch target.
- Activating the control still saves nothing: no `subject.items` mutation, no new
  storage key, and no change to the pending counter, priority, completion,
  tracking, suggestion, order, ids or exported JSON.
- Preserve all TS-012 behavior: initially expanded, per-parent independent
  collapse, transient tab-local state reset after reload, new tab or import,
  children unchanged and in the same order.
- Add deterministic Node tests for the pure label/formatting logic (0 / 1 /
  several substeps, filter, non-mutation) and update the product documentation.

## Capabilities

### New Capabilities

- None. The label is part of the existing `substep-collapse` capability.

### Modified Capabilities

- `substep-collapse`: the disclosure control's visible label becomes a dynamic
  count (« Voir 1 sous-tâche » / « Voir N sous-tâches » when collapsed,
  « Masquer les sous-tâches » when expanded), and its accessible name is updated
  to include that label and the parent title. Presence, hiding, ARIA state,
  per-parent independence, transient state, no-mutation and filter-interaction
  requirements are unchanged.

## Impact

- `site/core.js`: a pure, non-mutating label-formatting helper (for example
  `substepToggleLabel(visibleCount, collapsed)`) reused by the renderer; the
  existing `substepView` already exposes `children` and `collapsed`.
- `site/app.js`: `renderSubstepToggle` uses the helper for the button text and
  the accessible name; `aria-expanded`, `aria-controls`, click wiring and
  deferred focus stay as they are.
- `tests/core.test.mjs`: deterministic tests for 0 / 1 / several visible
  substeps, the completion filter and non-mutation.
- `docs/product/guide-utilisation.md` and `docs/product/mvp.md`: the new labels
  and the count semantics, plus a matching acceptance test.
- Unchanged: document schema and version (`threadstep.document.v1`), JSON shape
  and ids, the `threadstep.resume.v1` preference, storage keys, dependencies,
  network activity, `site/styles.css` (the control already has its touch target)
  and GitHub workflows. Independent of TS-014: no drag handle, substep move or
  pointer-event change.

## Non-Goals / Out of Scope

- Reordering, completing, deleting or moving substeps, or changing their state.
- Persisting a count or a collapse preference, collapsing by default, or adding
  a « tout replier » control.
- More than one nesting level, a second toggle control, animations, workflows,
  factory configuration, secrets or merge rules.

## Unresolved Decisions / Uncertainties

- **Exact accessible-name wording.** Planned: the accessible name is the visible
  label followed by the parent title, e.g.
  `aria-label="Voir 2 sous-tâches de « titre »"` / `"Masquer les sous-tâches de « titre »"`,
  matching the current pattern. The precise connector can be confirmed during
  review without changing the specs.
- **Helper shape.** Planned: a pure `substepToggleLabel(visibleCount, collapsed)`
  in `site/core.js` rather than inline formatting, so the singular/plural rule is
  unit-testable in Node. The exact name is an implementation detail.
- **Zero visible substeps.** The helper is never called with 0 because no button
  is rendered then; the planned return for that defensive case (the expanded
  label or an empty string) is safe to settle during apply and does not affect
  observable behavior.
