# Design

## Context

See `proposal.md` — Why. One-level substeps already exist (`parentId` on
`newItem`, `site/core.js:8-10`). `renderItem` computes
`visibleItems(subject.items, item.id, hideCompleted)` and, if non-empty, appends
a `ul.tasks.children` after the row and its actions (`site/app.js:380-396`).
`visibleItems` filters by the completed rule through `isItemVisible`
(`site/core.js:39-45`). Every mutation calls `persist()`, which writes
`threadstep.document.v1` and fully re-renders (`site/app.js:35-47`); `render()`
wipes `#subjects` with `replaceChildren()` (`site/app.js:91-104`). Deferred focus
is already used through module flags (`focusItemId`, `pendingMoveFocus`)
consumed by `applyFocus()` after a re-render (`site/app.js:105-142`). Imports
replace the document and call `persist()` (`site/app.js:676-693`). Domain logic
is covered by pure Node tests in `tests/core.test.mjs`; there is no DOM harness
and no dependency budget.

Constraints: browser-only, no new dependency, no new storage key, no
schema/version change, French accessible UI, preserve TS-005/008/010/011
behavior.

## Goals / Non-Goals

**Goals:**

- A pure, DOM-free, deterministic decision for what a parent shows and whether a
  disclosure control is offered.
- A transient, tab-local collapsed-parent set that never touches the document.
- A native, accessible disclosure button with exact ARIA state, focus continuity
  and a ≥ 44 × 44 px touch target.
- Correct interaction with the completed filter and with all existing business
  rules.

**Non-Goals:**

- Persisting collapse, mutating data, or changing export/import.
- Multiple nesting levels, a « tout replier » control, animations or a tree.
- A DOM test harness or any dependency.

## Decisions

1. **One pure helper in `site/core.js` for the whole presentation decision.**
   - `substepView(items, parentId, hideCompleted, collapsedIds)` returns
     `{ children, hasVisibleSubsteps, collapsed, renderChildren }`:
     `children = visibleItems(items, parentId, hideCompleted)`;
     `hasVisibleSubsteps = children.length > 0`;
     `collapsed = hasVisibleSubsteps && collapsedIds instanceof Set &&
     collapsedIds.has(parentId)`; `renderChildren = hasVisibleSubsteps &&
     !collapsed`. A `null`/`undefined` parent yields an empty, non-collapsed
     view.
   - **Rationale:** centralizes the rule "a parent gets a control iff it has a
     visible substep" and the render decision in one testable place, and reuses
     the existing `visibleItems`. Alternative rejected: recomputing conditions
     inline in `renderItem` (untestable in Node) and a new parallel visibility
     function (duplicates the completed-filter rule).

2. **Pure, non-mutating toggle of the collapsed set.**
   - `toggleCollapsedParent(collapsedIds, parentId)` returns a **new** `Set`
     with `parentId` added or removed, never mutating its input (treats a
     non-Set input as empty).
   - **Rationale:** keeps the transient state easy to test for non-mutation and
     matches the existing style of pure helpers returning new values.

3. **Tab-local collapsed set in `site/app.js`.**
   - A module-level `let collapsedParents = new Set();` holds collapsed parent
     ids. It is presentation-only: it is never serialized, never included in the
     document and never written to storage.
   - On a successful JSON import the set is reset (`collapsedParents = new
     Set()`), so the imported display starts expanded. A reload or a new tab
     naturally starts expanded because the module initializes empty.
   - `renderItem` calls
     `substepView(subject.items, item.id, hideCompleted, collapsedParents)`:
     `hasVisibleSubsteps` decides whether to render the control,
     `renderChildren` decides whether to append the `ul.tasks.children`, and
     `children` are the items to append.
   - **Rationale:** survives ordinary re-renders because the set is module
     state and `persist()` does not clear it; resets where the spec requires.

4. **Disclosure control inside `renderActions`, top-level only.**
   - In `renderActions`, when `item.parentId === null` and the parent has visible
     substeps, append `<button type="button" class="subtle task-toggle">` whose
     text is « Replier » when expanded and « Déplier » when collapsed, with an
     accessible name naming the action (for example
     `aria-label="Replier les sous-étapes de « titre »"`).
   - `aria-expanded` is always set to `"true"`/`"false"` from the state. When
     `renderChildren` is true the `ul` gets a per-render identifier and the
     button gets `aria-controls` pointing to it; when the parent is collapsed no
     list is rendered and `aria-controls` is omitted.
   - Clicking calls `toggleCollapsedParent`, stores `pendingCollapseFocus =
     item.id` and calls `render()`. It never calls `persist()`.
   - **Rationale:** keeps the control beside the other action controls, works
     because `renderActions` already knows the item and subject, and guarantees
     no drag (drag binds only on `.task-handle`) and no editor. Alternative
     rejected: `hidden` on a persistent list (leaves inert markup in the DOM and
     requires an always-present id) and toggling via CSS only (not exposed to
     assistive technology).

5. **Deferred focus.**
   - `applyFocus()` gains a `pendingCollapseFocus` branch that finds the task by
     `data-item`, queries its `.task-toggle` and focuses it (scrolling into view
     with `block: "nearest"`), mirroring the existing `pendingMoveFocus` pattern.
   - **Rationale:** the full re-render destroys the activated button, so focus
     must be restored after render; the pattern is already proven in this file.

6. **Conditional list rendering for true hiding.**
   - When `renderChildren` is false, the `ul.tasks.children` is not created, so
     no substep is in the accessibility tree and no substep control is
     focusable. When true, the list is created with the identifier referenced by
     `aria-controls`.
   - **Rationale:** the acceptance criteria state that a collapsed list is truly
     hidden and that `aria-controls` is required "whenever that list exists";
     not rendering it satisfies both without extra `hidden` bookkeeping.

7. **Styles in `site/styles.css`.**
   - A `.task-toggle` rule with `min-width`/`min-height` 44 px, comfortable
     padding, the existing focus-visible treatment and no animation outside a
     `prefers-reduced-motion: no-preference` guard.
   - **Rationale:** matches the touch-target decision already used for
     `.task-handle` and `.snackbar-undo`.

8. **Tests and docs.**
   - `tests/core.test.mjs` gains pure tests: children present/absent, two
     independent parents, the completion filter (some/all substeps hidden) and
     non-mutation of both `items` and the collapsed set.
   - `docs/product/guide-utilisation.md` documents the gesture, its temporary
     tab-local scope and the filter interaction; `docs/product/mvp.md` gains the
     functional requirement and acceptance test. The canonical OpenSpec spec is
     updated only through the OPSX sync after implementation, never during
     apply.

## Risks / Trade-offs

- **Full re-render on every operation** → the collapsed set is module state and
  is only cleared on import, so a normal re-render cannot expand a collapsed
  parent unexpectedly.
- **Stale ids in the set** after a substep or parent is removed, or after the
  filter hides everything → harmless: `substepView` ignores ids without visible
  children and never mutates data; the spec does not require pruning.
- **`aria-controls` and generated ids** → the list id is generated per render
  (counter or sanitized derived value) instead of using a raw item id, avoiding
  invalid ids or whitespace breaking the reference.
- **Accessible name length** → names include the action title, which is up to
  300 characters; the title is used only as text and remains understandable.
- **No DOM harness** → ARIA, focus and hiding are verified manually plus by pure
  logic tests; adding a DOM harness would need explicit approval and a
  dependency budget.

## Migration Plan

None. No schema, version, storage-key or export change; the collapsed state is
in-memory only. Rollback removes the control, the set and the helper; stored
documents and exports stay valid.

## Open Questions

None that change the specs, approach or task breakdown. Control placement,
`aria-controls` omission while collapsed, the reset policy on a cross-tab
`storage` update and the list-id source are recorded as assumptions in
`proposal.md` and are safe to confirm during review.
