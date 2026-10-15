# Design

## Context

See `proposal.md` — Why. Display order today comes from `sortedItems(items,
parentId)`, which filters to one level and sorts **by priority only** with the
base array order kept on ties (`site/core.js:35-38`); `visibleItems` layers the
completed filter on top (`site/core.js:43-45`). `renderSubject` builds `ul.tasks`
from `visibleItems(subject.items, null, hideCompleted)` and `renderItem` renders
each row plus `renderActions` (`site/app.js:353-439`). Every accepted mutation
calls `persist()`, which writes `threadstep.document.v1` and fully re-renders
(`site/app.js:35-44`). Focus is deferred through `focusItemId`/`focusSubjectId`
and consumed by `applyFocus()` after a re-render (`site/app.js:101-121`). Subject
reordering already uses a pure `moveSubject` with `move()` + `focusAfterMove`
(`site/core.js:11-18`, `site/app.js:271-286`). Domain logic is tested with pure
Node tests in `tests/core.test.mjs`; there is no DOM harness and no dependency
budget.

Constraints: browser-only, no new dependency, no new storage key, no
schema/version change, strict priority grouping preserved, French accessible UI.

## Goals / Non-Goals

**Goals:**

- Pure, DOM-free and deterministic within-priority ordering helpers.
- Reorder only top-level items of one priority in one subject; leave every other
  item's position, object identity and data provably intact.
- Drag handle (pointer/finger/stylus) plus an accessible Monter/Descendre
  alternative.
- One persistence per accepted gesture; cancellation mutates and saves nothing.
- Reordering suspended under the completed filter with a short explanation.
- Accessibility, mobile ergonomics and reduced-motion compliance.

**Non-Goals:**

- Cross-subject or cross-priority moves; changing priority by drag.
- Reordering substeps or re-parenting them; reordering subjects.
- Schema, version, storage-key or export/import shape changes.
- A position/`order` field, movement history, a DOM harness or any dependency.

## Decisions

1. **Pure group-slot reordering in `site/core.js`.**
   - `reorderWithinPriority(items, itemId, targetId, position)` with
     `position ∈ {"before", "after"}`. Validate that both ids exist, both are
     top-level (`parentId === null`), they share a `priority` and are distinct;
     otherwise return the **same** array reference (mirrors `moveSubject`/
     `updateItem`).
   - Compute `slots` = ascending indices `i` where `items[i].parentId === null &&
     items[i].priority === priority`, and `group` = the items at those slots.
     Remove `itemId` from `group`, insert it before/after `targetId`; if the new
     order equals the old, return the same reference. Return a shallow copy of
     `items` with the reordered `group` written back into the original `slots`;
     every other index keeps its exact object.
   - `moveWithinPriority(items, itemId, direction)` performs the adjacent group
     move through the same primitive (`up` = before the previous group item,
     `down` = after the next group item).
   - `canReorderWithinPriority(items, itemId, targetId, position)` and
     `canMoveWithinPriority(items, itemId, direction)` expose validity for drop
     highlighting and the disabled state of the move buttons.
   - **Rationale:** writing the reordered group back into its original physical
     slots leaves other priorities, substeps and unrelated data untouched and
     preserves `sortedItems`' tie invariant by construction. Alternative
     rejected: splicing the whole array (risks crossing priorities) or an
     `order` field (schema change, forbidden).

2. **Handle and Monter/Descendre inside `renderActions` (`site/app.js`).**
   - Only `item.parentId === null` gets a handle and the two move buttons.
   - Handle: `<button type="button" class="task-handle" aria-label="Déplacer
     « titre » (priorité …)">` with `touch-action:none`; pointer listeners live
     **only** on the handle, so « Modifier », « Retirer », « Garder le fil » and
     the completion checkbox never start a drag.
   - Monter/Descendre: `<button>`s with accessible names naming the action and
     priority; `disabled` from `canMoveWithinPriority`; on activation call
     `moveWithinPriority`, update the subject's `items`, persist once and set a
     deferred focus target.
   - Focus: add `pendingMoveFocus = { itemId, direction }`, consumed by
     `applyFocus()` to focus the moved action's handle (or the corresponding move
     button), keeping tab order usable after the full re-render.

3. **Drag through Pointer Events.**
   - `pointerdown` on a handle: `setPointerCapture`, store subject/item ids and
     start coordinates, add a `dragging` class. No mutation.
   - `pointermove`: `document.elementFromPoint`, find the closest `.task` in the
     same subject, read `dataset.item`, derive `{targetId, position}` from the
     row's vertical midpoint and validate with `canReorderWithinPriority`; show a
     `drop-before`/`drop-after` indicator **only** on valid targets.
   - `pointerup`: if the last candidate was valid, apply
     `reorderWithinPriority`, assign the new `subject.items`, persist **once**,
     announce through the existing `#status` live region and move focus to the
     handle; otherwise treat as cancelled.
   - `pointercancel` and an `Escape` key listener cancel: clear classes and
     indicators, no mutation, no save.
   - `pointer-events:none` on the dragged row while dragging so
     `elementFromPoint` resolves the row underneath. Alternative rejected: HTML5
     drag-and-drop (weak touch support) and external libraries (forbidden).

4. **Filter suspension.** When `hideCompleted` is true, render no handles, set
   the move buttons `disabled`, and show a short French note near the filter
   explaining that all steps must be shown to reorganise. Re-enabling restores
   the controls; the stored order is never touched by a toggle.

5. **Persistence and portability.** A reorder replaces only the order of one
   subject's `items` array and reuses `persist()`; ids, titles, priorities,
   `done` flags, `parentId`, other subjects, the version and the storage key are
   unchanged, so exports and imports round-trip the new order with no migration.

6. **Docs and tests.** `docs/product/mvp.md` gains the functional requirement and
   an acceptance test. `tests/core.test.mjs` gains pure tests for valid moves,
   boundaries, mixed priorities, substeps, invalid-target immutability, absence
   of input mutation, a suggestion-follows-order check and a JSON round-trip.

## Risks / Trade-offs

- **`elementFromPoint` geometry across nested rows** → derive the insertion from
  the hovered row's vertical midpoint, restrict candidates to the same subject
  and priority, and fall back to a no-op when nothing valid is under the
  pointer.
- **Pointer capture versus touch scrolling** → `touch-action:none` only on the
  handle; scrolling elsewhere is untouched and `pointercancel` aborts the drag.
- **Full re-render during a gesture** → drag state lives in module variables and
  transient classes; nothing is persisted mid-gesture, so a surprising re-render
  simply ends the gesture without a write.
- **Focus loss after re-render** → reuse the proven deferred-focus pattern.
- **Completed and hidden actions interleaved** → reordering is suspended while
  the completed filter is active.
- **Pointer-only handle exposed to AT** → Monter/Descendre is the guaranteed
  keyboard path and the handle still carries a descriptive name.

## Migration Plan

None. No schema, version, storage-key or export change; the order is stored in
the existing `subject.items` array. Rollback removes the handle, the buttons and
the helpers; stored documents and exports stay valid.

## Open Questions

None that change the specs, approach or task breakdown. Handle semantics,
completed-action eligibility, end-of-group drops and drop styling are recorded
as assumptions in `proposal.md` and are safe to confirm during review.
