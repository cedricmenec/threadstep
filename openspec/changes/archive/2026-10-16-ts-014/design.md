# Design

## Context

See `proposal.md` — Why, and the TS-011 archive for the top-level ordering it
extends. Ordering today is one pure group-slot operation in `site/core.js`: a
group is "the top-level items (`parentId === null`) of one priority" and a
reorder writes only that group's items back into their original physical slots
(`site/core.js:68-114`). `renderSubject` renders `visibleItems(subject.items,
null, hideCompleted)` and `renderItem` appends `renderActions`, which calls
`renderReorderControls` **only when `item.parentId === null`** (`site/app.js:
387-413`, `site/app.js:566-568`). Drag uses Pointer Events on the handle only
(`site/app.js:461-551`): `pointerdown` records `{ subjectId, itemId }`,
`pointermove` resolves the innermost `.task` under the pointer with
`document.elementFromPoint`, validates with `canReorderWithinPriority`, and
`pointerup` applies `reorderWithinPriority` and calls `persist()` once.
Cancellation uses `Escape`, `pointercancel` and a missing candidate. Every
accepted mutation calls `persist()`, which writes `threadstep.document.v1` and
fully re-renders (`site/app.js:40-49`); deferred focus flags
(`pendingMoveFocus`, `pendingCollapseFocus`) are consumed by `applyFocus()`
after the re-render. Domain logic is covered by pure Node tests in
`tests/core.test.mjs`; there is no DOM harness and no dependency budget.

Constraints: browser-only, no new dependency or storage key, no schema/version
change, French accessible UI, strict priority grouping, and the TS-011
top-level gesture must stay identical.

## Goals / Non-Goals

**Goals:**

- Reuse one deterministic, DOM-free group-slot primitive whose group is
  identified by `(parentId, priority)`.
- Reorder a substep only among its direct siblings of the same priority;
  leave every other item's position, object identity and data provably intact.
- Offer the substep handle and « Monter » / « Descendre » through the existing
  render, drag, focus and persistence paths.
- Keep top-level ordering byte-for-byte identical in behavior.
- Suspend substep reordering under the completed filter and hide it for a
  collapsed parent, with no new state.

**Non-Goals:**

- Cross-parent, cross-subject, cross-priority or level-changing moves; changing
  a priority by drag.
- Schema, version, storage-key or export/import shape changes.
- A DOM harness, a new dependency or a rewritten drag pipeline.

## Decisions

1. **Widen the existing group-slot primitive to `(parentId, priority)`.**
   - `reorderWithinPriority(items, itemId, targetId, position)` keeps its name
     and signature. It validates that both ids exist, are distinct, share the
     same `parentId` and the same `priority`, and that `position` is `"before"`
     or `"after"`; otherwise it returns the **same** array reference. It computes
     `slots` = ascending indices where `items[i].parentId === source.parentId &&
     items[i].priority === source.priority`, removes the source from that group,
     inserts it before/after the target, and writes the group back into the same
     slots.
   - `moveWithinPriority(items, itemId, direction)` drops its
     `parentId !== null` guard and moves by one rank inside the same
     `(parentId, priority)` group through the same primitive.
   - `canReorderWithinPriority` and `canMoveWithinPriority` stay the same
     derived predicates.
   - **Rationale:** the top-level case is exactly the special case
     `parentId === null`, so existing behavior is preserved by construction;
     cross-parent pairs (`null` vs. an id, or two different ids) are refused by
     the shared-parent check, which also prevents re-parenting. Existing tests
     stay valid because every cross-parent assertion already returns the same
     reference. Alternatives rejected: a second set of substep-only helpers
     (duplicated logic, risk of divergence) and a new `order` field (forbidden
     schema change).

2. **Render the reorder controls for both levels in `renderActions`.**
   - Drop the `item.parentId === null` condition around
     `renderReorderControls`; every item gets a handle and the two move buttons.
   - Accessible names for substeps name the substep title, its priority and its
     parent (for example `"Monter « sous-tâche » (sous-étape de « parent »,
     priorité Normal)"`), keeping titles as text nodes. Top-level names are
     unchanged.
   - Boundaries already come from `canMoveWithinPriority`, which now reflects
     the parent+priority group. No new control type is introduced.

3. **Reuse the single drag pipeline unchanged.**
   - `startDrag` / `resolveDropTarget` / `onDragEnd` already resolve `.task`
     elements inside the same subject and validate through
     `canReorderWithinPriority`. Once that predicate is parent+priority aware, a
     substep can only drop on a sibling substep of the same parent and priority;
     a drop on a parent row, another parent's child, a top-level action or empty
     space is refused by the predicate and never reaches `persist()`.
   - `elementFromPoint` on nested rows resolves the innermost `.task`, which is
     the intended target. No new listeners, no new state and no change to
     cancellation.

4. **Filter suspension is inherited, not re-implemented.** `renderReorderControls`
   already keys off `hideCompleted`: it renders no handle, disables the move
   buttons and the shared `#reorder-note` explanation is shown by `render()`.
   Because substeps use the same function, the suspension applies to both levels
   with no code branch.

5. **Collapse interaction needs no new state.** A collapsed parent does not
   render its `ul.tasks.children`, so no substep handle or drop target exists and
   the stored order cannot change; expanding re-renders the same stored order.
   This satisfies "a collapsed parent cannot receive an invisible substep move".

6. **Persistence and portability.** A substep reorder replaces only the order of
   the affected slots inside one subject's `items` array and reuses `persist()`.
   Ids, titles, priorities, `done` flags, `parentId`, other subjects, the version
   and the storage key are unchanged, so exports and imports round-trip the new
   order with no migration.

7. **Docs and tests.** `tests/core.test.mjs` gains pure substep-group tests and
   an explicit "top-level behavior unchanged" test. `docs/product/mvp.md` gains
   the functional requirement and acceptance test; `docs/product/
   guide-utilisation.md` gains the user-facing section.

## Risks / Trade-offs

- **Nested-row geometry during drag** → resolve the innermost `.task`, restrict
  candidates to the same parent+priority through the predicate, and fall back to
  a no-op when nothing valid is under the pointer.
- **Accidental top-level regression** → the widened predicate refuses every
  cross-parent pair, and the existing TS-011 tests plus a dedicated
  "top-level behavior unchanged" test guard the path.
- **Denser controls on a phone** → reuse the existing ≥ 44 × 44 px handle and
  button styles and verify at a narrow viewport; no layout redesign.
- **Canonical spec drift** → the delta MODIFIES the two `action-ordering`
  requirements that asserted substeps never have a handle or reorder target, so
  the canonical text no longer contradicts the shipped behavior.

## Migration Plan

None. No schema, version, storage-key or export change; the order is stored in
the existing `subject.items` array. Rollback removes the substep handle and move
buttons and reverts the widened helper scope; stored documents and exports stay
valid.

## Open Questions

None that change the specs, approach or task breakdown. The exact accessible-name
connector and the final visual placement of the substep controls are recorded as
uncertainties in `proposal.md` and are safe to confirm during review.