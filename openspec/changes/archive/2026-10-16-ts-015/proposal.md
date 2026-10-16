# Proposal

## Why

ThreadStep already displays each action's priority as a static Urgent / Normal /
Plus tard badge and lets the user change it only through the full « Modifier »
editor (TS-010, FR-10). Changing priority is a frequent daily arbitration, but it
currently costs opening a title editor and saving. TS-015 turns the existing
badge into a fast, accessible in-place priority control for both top-level
actions and one-level substeps, reusing the existing priorities, schema and
persistence.

## What Changes

- Replace the decorative priority badge on every top-level action **and**
  one-level substep with an interactive French control of the same visual
  appearance that opens an explicit choice among Urgent, Normal, Plus tard while
  showing the current value.
- Apply a chosen priority to the targeted item only, immediately update its badge
  and visual class, persist locally once, and re-display steps in the existing
  priority groups. A substep keeps its parent.
- Treat the already-selected value, a closed choice without selection and Escape
  as no-ops that write neither the document, nor localStorage, nor the export.
- Keep the control from starting a drag or triggering completion, substep
  collapse, removal or the title editor; keep mouse, touch, Tab, Enter, Space and
  Escape usable with a ≥ 44 × 44 px touch target.
- Add a pure priority-change helper in `site/core.js`, deterministic Node tests,
  and update the product guide and MVP requirement.
- No new field, storage key, document version, dependency, network call or
  workflow.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `action-editing`: adds a badge-based, title-free priority change for actions
  and substeps, distinct from the existing full inline editor, with the same
  identity, hierarchy and persistence guarantees.

## Impact

- `site/core.js`: add a pure `setItemPriority(document, subjectId, itemId,
  priority)` helper that changes only the targeted `priority`.
- `site/app.js`: render the badge as an interactive control in `renderRow` and
  wire a real change to the helper plus a single `persist()`, keeping focus.
- `site/styles.css`: keep the badge look while providing a ≥ 44 × 44 px target, a
  visible focus state and reduced-motion-safe styling.
- `tests/core.test.mjs`: deterministic tests for allowed values, no-op,
  immutability, subtasks, sorting, persistence/round-trip and non-regression.
- `docs/product/guide-utilisation.md`, `docs/product/mvp.md`: new section and
  FR-18 with its acceptance test.
- Unchanged: document schema and version, `threadstep.document.v1`,
  `threadstep.resume.v1`, JSON shape, dependencies, network, workflows,
  `AGENTS.md`, `backlog/` and `docs/factory/`.

## Non-Goals / Out of Scope

- A real « à faire / en cours / bloqué » business status; changing the meaning of
  the completion checkbox or editing completion from the badge.
- Bulk priority editing of several items; moving items between projects or
  parents; adding a second nesting level.
- Changing the full « Modifier » editor (its priority setting stays available),
  the drag reordering, the collapse control, removal or tracking.
- Archiving, cross-device synchronization, services, dependencies, secrets or
  workflows.

## Unresolved Decisions / Uncertainties

- **Control widget.** Planned: a native `<select>` styled as the badge. It gives
  the required mouse, touch, Tab, Enter, Space and Escape behaviour and a labelled
  current value without a custom focus-trapping menu. Rejected alternative: a
  custom button + `aria-haspopup` listbox, more code and more accessibility risk
  for no observable gain. Exact visual parity with the old badge is a review
  detail.
- **Accessible-name connector.** Planned: `Priorité de « titre » : Normal`. The
  exact connector wording can be settled during review without changing scope.
- **Placement.** Planned: keep the control in the existing `.task-row` at the
  badge position; exact narrow-screen wrapping is a review detail.
