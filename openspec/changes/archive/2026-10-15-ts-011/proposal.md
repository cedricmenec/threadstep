# Proposal

## Why

Within a single priority ThreadStep currently shows actions in insertion order, so
the user cannot say which of two equally-urgent (or equally-normal) actions to
tackle first. ThreadStep's promise is to make the *next* action obvious; letting
the user rank same-priority actions by drag-and-drop, with an accessible
up/down alternative, makes that ranking explicit while the strict
urgent → normal → later grouping and all stored data stay untouched (FR-04).

## What Changes

- Add a visible, labelled **drag handle** on every top-level action
  (`parentId === null`); dragging it with a mouse, finger or stylus reorders the
  action inside its own priority group.
- Accept a drop only **inside the same subject, at the same level, among
  top-level actions of the same priority**; drops on another subject, another
  priority, a substep, empty space or any other target are refused with **no
  document mutation and no storage write**.
- Keep the strict presentation order **urgent, then normal, then later**; inside
  a priority show the manually chosen order. No new `order` field — persist the
  new sequence in the existing `subject.items` array.
- Carry a moved parent's **substeps** with it visually; children keep `parentId`,
  ids, titles, priorities, flags and their own order. Substeps are not
  independent drop targets.
- Add an accessible, non-drag alternative: **Monter / Descendre** controls on
  each top-level action moving it exactly one rank inside its priority group,
  disabled at the group boundaries and never changing priority.
- Show clearly the handle, the dragged action and the **valid** drop positions;
  refuse an invalid hover or drop without mutation or save and give
  understandable feedback.
- Use robust **Pointer Events**; handle at least 44 × 44 px, cancel cleanly on
  Escape, `pointercancel`, invalid target or interruption, keep page scroll
  natural outside the handle and show a readable drop hint on narrow screens.
- Persist through the existing localStorage path; the new order survives reload
  and is included in JSON export/import with **no migration and no document
  version change**.
- Keep delivered features coherent: counter, add/edit/complete, TS-007
  suggestion (follows the new within-subject item order), TS-008 tracking
  (stable ids) and TS-010 undo (restores the recorded position).
- While **« Masquer les étapes terminées »** is enabled, suspend reordering and
  briefly explain that all steps must be shown to reorganise; filtering is
  otherwise unchanged.
- Update `docs/product/mvp.md` and add deterministic Node tests for a pure
  reordering function.

## Capabilities

### New Capabilities

- `action-ordering`: manual ordering of top-level actions inside their priority
  group, by drag handle or Monter/Descendre, persisted in the existing document
  without changing priorities, hierarchy, other groups or the schema.

### Modified Capabilities

- (none) `next-action-suggestion` already breaks within-subject ties by the
  "underlying item order"; because reordering rewrites `subject.items`, the
  suggestion automatically follows the new order and no requirement text
  changes. `resume-tracking` and `action-removal` key on stable ids and recorded
  positions and are unchanged.

## Impact

- `site/core.js`: pure, non-mutating reordering helpers (directional move and
  drop-before/after) plus boundary predicates.
- `site/app.js`: drag-handle rendering and Pointer Events, drop-target
  computation, Monter/Descendre controls, filter suspension, focus and
  live-region announcements, a single persistence at gesture end.
- `site/styles.css`: handle (min 44 × 44, `touch-action`), dragged/valid-drop
  states, drop hint, `prefers-reduced-motion` guard.
- `tests/core.test.mjs`: deterministic tests for valid moves, boundaries, mixed
  priorities, substeps, invalid-input immutability and JSON round-trip.
- `docs/product/mvp.md`: a new functional requirement and acceptance test.
- Unchanged: document schema and version, `threadstep.document.v1`, JSON shape,
  subject reordering (TS-004), priorities, dependencies, workflows and factory
  policy.

## Non-Goals / Out of Scope

- Moving actions between subjects, changing priority by drag, reordering
  substeps individually or re-parenting them.
- Reordering subjects (already accessible buttons in TS-004).
- Reordering while the completed-steps filter hides items.
- Any position field, schema change, movement history, cross-device sync,
  system notifications, JS dependency, account or backend.

## Unresolved Decisions / Uncertainties

- **Handle semantics for keyboard.** Plan: the handle is a focusable button with
  an accessible French name naming the action and its priority, used for pointer
  dragging; keyboard and no-drag users rely on the mandated Monter/Descendre
  buttons. Confirmation welcome.
- **Completed actions.** Plan: completed top-level actions are reorderable when
  visible (filter off), because they are same-priority top-level actions and
  their `done` flag is preserved. Confirm whether they should be excluded.
- **End-of-group drop.** "Entre deux actions de même priorité" is read to include
  the top and the bottom of the group (move before the first or after the last
  same-priority action). Confirm.
- **Drop feedback.** An insertion indicator derived from the pointer's vertical
  position over the target row; exact styling and hint wording to confirm during
  review.
- **DOM coverage.** As in TS-008/TS-009/TS-010 the repository has no DOM test
  harness and no dependency budget, so deterministic ordering is covered by pure
  Node tests and the pointer/drag wiring is verified manually; adding a DOM
  harness would need explicit approval.
