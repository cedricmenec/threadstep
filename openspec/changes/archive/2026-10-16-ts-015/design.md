# Design

## Context

See `proposal.md` — Why. Priority is a field of every item, restricted to
`PRIORITIES = ["urgent", "normal", "later"]` (`site/core.js:4`). Today the badge
is a non-interactive `<span class="priority priority-<value>">` appended in
`renderRow` (`site/app.js:425`). The only mutation path is the inline editor:
`renderEditor` calls `updateItem(document, subjectId, itemId, { title,
priority })` (`site/app.js:655`), and `updateItem` requires a valid title and
refuses an unchanged title/priority pair by returning the same reference
(`site/core.js:19-34`). Every accepted mutation calls `persist()`, which writes
`threadstep.document.v1` and fully re-renders (`site/app.js:40-49`). Display order
comes from `visibleItems` → `sortedItems`, which sorts by `priorityIndex`
(`site/core.js:35-45`), so a changed priority is re-grouped automatically by the
next render. Deferred focus flags (`pendingMoveFocus`, `pendingCollapseFocus`) are
consumed by `applyFocus()` after a re-render (`site/app.js:107-155`). Domain logic
is covered by pure Node tests in `tests/core.test.mjs`; there is no DOM harness
and no dependency budget. `renderRow` is shared by top-level actions and
one-level substeps, so one implementation covers both.

Constraints: browser-only, no new dependency or storage key, no schema/version
change, French accessible UI, untrusted titles as text nodes, and the existing
completion, collapse, removal, ordering and editor controls must keep working.

## Goals / Non-Goals

**Goals:**

- Make the existing badge on actions and substeps an accessible in-place priority
  control with a single deterministic mutation primitive.
- Apply a chosen priority to exactly one item, immediately and with one save, and
  re-group it through the existing sort.
- Guarantee that the current value, a closed choice without selection and Escape
  write nothing.
- Keep the control from starting any adjacent gesture and keep keyboard focus
  usable across the re-render.

**Non-Goals:**

- A custom focus-managed menu, a DOM test harness or a new dependency.
- Bulk priority editing, re-parenting, level changes or a business status.
- Any schema, version, storage-key or export/import shape change.

## Decisions

1. **Use a native `<select>` styled as the badge.**
   - `renderRow` renders a `<select class="priority priority-<value>
     priority-control">` with three options (`Urgent`, `Normal`, `Plus tard`)
     and the current value selected, replacing the decorative span.
   - The `change` event only fires when the value actually changes, so
     re-selecting the current value is a natural no-op; Escape closes the native
     control without firing `change`.
   - The `aria-label` is contextual, e.g. `Priorité de « titre » : Normal`.
   - **Rationale:** a select provides Tab/Enter/Space/Escape and screen-reader
     semantics for free and needs no focus-trap or outside-click handling.
     Alternatives rejected: a custom button + `aria-haspopup` menu (more code,
     more accessibility risk) and making the badge a `<button role="radio">`
     group (invented interaction, denser markup).
   - **Trade-off:** native select chrome varies by browser; `appearance: none`
     plus the existing badge classes keeps the look close, and visual parity is a
     review detail recorded in `proposal.md`.

2. **Add one pure mutation primitive in `site/core.js`.**
   - `setItemPriority(document, subjectId, itemId, priority)` validates the
     document, subject, item and that `priority` is in `PRIORITIES`. Missing
     entities, an invalid priority or an unchanged priority return the **same**
     document reference. Otherwise it maps a new document whose only change is the
     targeted item's `priority`.
   - **Rationale:** it does not require a title (unlike `updateItem`), so it
     cannot accidentally open or affect title editing, and it mirrors the
     immutability pattern of `updateItem`. Alternative rejected: reusing
     `updateItem` with the existing title couples the badge to title validation.
   - The function does not reorder anything: display order is derived.

3. **Wire the `change` event to the primitive, persist once, keep focus.**
   - On `change`, call `setItemPriority(documentState, subject.id, item.id,
     value)`. If it returns the same reference, return without writing. Otherwise
     assign the new document, set a deferred `pendingPriorityFocus = item.id`,
     `persist()` once and announce a short French message.
   - `applyFocus()` gains a branch that focuses the `.priority-control` of that
     item after the re-render, so keyboard focus survives and Tab/Enter/Space/
     Escape stay usable. This mirrors `pendingMoveFocus`.
   - **Rationale:** `persist()` replaces the DOM, so a deferred focus flag is the
     existing, proven pattern.

4. **No drag or adjacent-control conflict.**
   - The drag pipeline starts only on `.task-handle` `pointerdown`
     (`site/app.js:450-483`); the checkbox, « Modifier », « Retirer » and the
     collapse toggle are separate elements. Putting the control in `.task-row` at
     the badge position reuses that separation with no new listener.
   - A select swallows the pointer/keyboard events it needs, so it cannot start a
     drag or toggle a checkbox.

5. **Styling reuses the badge look and the existing accessibility rules.**
   - Keep the `priority` and `priority-<value>` classes; add a
     `priority-control` class with `min-height: 44px`, `min-width: 44px` and
     `appearance: none`, and reuse the global `:focus-visible` outline
     (`site/styles.css:6`). Any transition stays inside
     `@media (prefers-reduced-motion: no-preference)`.
   - **Rationale:** satisfies the ≥ 44 × 44 px target and visible focus without a
     layout redesign; the badge only grows to a comfortable tap size.

6. **No canonical-spec or migration work in this change.**
   - The delta ADDS requirements to `action-editing`; the canonical spec is
     updated by the reviewed OPSX sync, not during apply.
   - No schema, version or storage-key change, so there is no migration.

7. **Tests and docs.** `tests/core.test.mjs` gains deterministic tests for the new
   primitive (values, no-op, immutability, substeps, sorting, round-trip,
   non-regression of `updateItem` and the ordering helpers). The product guide and
   `docs/product/mvp.md` gain the user-facing section and FR-18 with its
   acceptance test. Automated tests cover the pure logic; the DOM interaction
   (native control, focus, Escape, drag isolation) is verified manually because
   the repository has no DOM harness.

## Risks / Trade-offs

- **Native select cross-browser styling** → keep the badge classes, use
  `appearance: none`, and verify at a narrow viewport; visual parity is a review
  detail.
- **Focus lost after `persist()` re-renders** → a `pendingPriorityFocus` flag
  consumed by `applyFocus()` restores focus to the same item's control.
- **Accidental adjacency with drag or checkbox** → keep the control in
  `.task-row`, rely on the existing per-element listeners, and assert no drag
  starts.
- **Stale derived state** → all read paths (`pendingCount`,
  `nextActionSuggestion`, `resumeView`, `sortedItems`, `renderEditor`) read the
  current `documentState`, which is replaced before the single `persist()`
  re-render.
- **Canonical spec drift** → the delta is additive and the post-sync review
  diffs the canonical `action-editing` spec against the delta.

## Migration Plan

None. The priority is stored in the existing item field; the storage key and
document version are unchanged, so stored documents and exports stay valid.
Rollback restores the decorative badge and removes the allowlisted helper and its
tests; no data migration is needed.

## Open Questions

None that change the specs, the approach or the task breakdown. The widget choice
is decided; the accessible-name connector, the exact visual parity and the
narrow-screen wrapping are recorded as uncertainties in `proposal.md` and are safe
to confirm during review.
