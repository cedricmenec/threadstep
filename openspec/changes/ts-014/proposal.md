# Proposal

## Why

ThreadStep already lets a user rank top-level actions inside each priority group
(TS-011, PR #34), but the one-level substeps of a parent action stay stuck in
insertion order. A user sequencing the concrete steps of one action cannot
reorder them even though the same gesture already exists one level up. TS-014
extends the proven TS-011 ordering to substeps of the same parent and same
priority, without changing their identity, priority, hierarchy or storage.

## What Changes

- Add a visible French drag handle and accessible « Monter » / « Descendre »
  controls to **one-level substeps**, reusing the TS-011 conventions: a handle of
  at least 44 × 44 px, a before/after drop indicator, contextualised accessible
  names, controls disabled at the group boundaries and a short French status
  message.
- Scope every substep reorder to the direct children of **one parent action
  sharing one priority** (`urgent`, `normal`, `later`). Cross-parent,
  cross-priority, cross-subject, level-changing, collapsed-parent and empty-target
  drops are refused with no document mutation and no localStorage write.
- Generalise the pure ordering helpers in `site/core.js` so a group is identified
  by **parent + priority** instead of top-level only, while the existing top-level
  drag-and-drop keeps behaving exactly as before.
- Suspend substep reordering while « Masquer les étapes terminées » is active,
  reusing the existing French explanation. Substeps of a collapsed parent stay
  hidden and cannot be manipulated; expanding restores them unchanged.
- Persist a valid move in the existing `subject.items` array with **no new field,
  storage key or document version**. Preserve ids, `parentId`, titles, priorities,
  `done` flags and unrelated children; the new order survives reload and JSON
  export/import.
- Keep the deterministic suggestion, the pending counter, « Je reprends ici »,
  removal undo, collapse/expand and the TS-013 button labels coherent regardless
  of substep order.
- Update the canonical specs, the product guide/MVP requirement and deterministic
  Node tests.

## Capabilities

### New Capabilities

- `substep-ordering`: ranks the direct substeps of one parent action inside each
  priority group through a drag handle or accessible move controls, keeping
  hierarchy, priorities and stored data intact.

### Modified Capabilities

- `action-ordering`: its statements that substeps never render a handle and are
  never reorder targets are scoped to the top-level ordering path, because
  substeps now have their own ordering controls owned by `substep-ordering`.
  Top-level behavior is otherwise unchanged.

## Impact

- `site/core.js`: widen `reorderWithinPriority` / `moveWithinPriority` and their
  predicates to a `(parentId, priority)` group.
- `site/app.js`: render the substep handle and « Monter » / « Descendre » in
  `renderActions`; the existing drag pipeline validates through the same
  predicate.
- `site/styles.css`: confirm nested substep reorder controls, drop indicators and
  the ≥ 44 × 44 px touch target at a narrow viewport.
- `tests/core.test.mjs`: substep-scoped reorder, refusals, boundaries,
  non-mutation, interleaving and round-trip tests.
- `docs/product/guide-utilisation.md`, `docs/product/mvp.md`: new requirement and
  guide section.
- Unchanged: document schema and version, `threadstep.document.v1`,
  `threadstep.resume.v1`, JSON shape, dependencies, network, workflows,
  `AGENTS.md`, `backlog/` and `docs/factory/`.

## Non-Goals / Out of Scope

- Moving a substep to another parent, subject or priority group; changing a
  priority during a move; adding a second nesting level; promoting a substep to a
  top-level action.
- Archiving, cross-device synchronization, new services, dependencies, secrets or
  workflows.
- Changing the TS-011 top-level gesture, the TS-012/TS-013 collapse control or its
  labels, or the removal-undo window.

## Unresolved Decisions / Uncertainties

- **Exact accessible-name wording for substep controls.** Planned: the substep
  title, its priority and an indication that it belongs to its parent action (for
  example `aria-label="Monter « sous-tâche » (sous-étape de « parent », priorité
  Normal)"`), matching the TS-011 pattern. The precise connector can be settled
  during review without changing the observable scope.
- **Helper naming.** Planned: keep the existing `reorderWithinPriority` /
  `moveWithinPriority` names and widen only their group definition to
  `(parentId, priority)`, so `site/app.js` needs no import change and the
  top-level path is provably identical. A separate substep-specific alias remains
  possible but is not required.
- **Single shared « Masquer les étapes terminées » note.** Planned: reuse the
  existing `#reorder-note` explanation for both levels rather than adding a second
  message. Its text stays as shipped for TS-011.
- **Exact location of the substep controls.** Planned: inside the existing
  `renderActions` group, so layout and focus handling are reused; the final visual
  placement is a review detail.