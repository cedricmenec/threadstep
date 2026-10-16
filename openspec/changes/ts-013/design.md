# Design

## Context

See `proposal.md` — Why. TS-012 already renders a native disclosure control for
each top-level action with visible substeps. `renderItem` computes
`substepView(subject.items, item.id, hideCompleted, collapsedParents)` and
`renderActions` appends `renderSubstepToggle(item, view)` when
`item.parentId === null && view.hasVisibleSubsteps` (`site/app.js:396-413`,
`site/app.js:565-568`). `renderSubstepToggle` currently hardcodes the labels
« Déplier » / « Replier » and the accessible name
`(Déplier|Replier) les sous-étapes de « titre »` (`site/app.js:552-564`).
`substepView` already returns `children` (the direct visible substeps, sorted,
filtered by `isItemVisible`) and `collapsed` (`site/core.js:46-54`).

`render()` fully re-renders after every operation (`site/app.js:93-105`), so the
count is naturally recomputed whenever a substep is added, removed, restored,
completed or filtered. Domain logic is covered by pure Node tests in
`tests/core.test.mjs`; there is no DOM harness and no dependency budget.

Constraints: browser-only, no new dependency, no new storage key, no
schema/version change, French accessible UI, preserve TS-012 and stay
independent of TS-014.

## Goals / Non-Goals

**Goals:**

- A pure, DOM-free, deterministic rule for the collapsed/expanded label.
- The count derives from the same visibility rule as the control's presence, so
  the number always matches what expanding would show.
- An accessible name that contains the current label and the parent title.
- Zero behavioral change beyond the label text.

**Non-Goals:**

- Any change to collapse mechanics, ARIA state, focus, hiding, storage or data.
- Persisting a count, adding a control, or touching TS-014 drag/move code.
- A DOM test harness or any dependency.

## Decisions

1. **One pure label helper in `site/core.js`.**
   - `substepToggleLabel(visibleCount, collapsed)` returns:
     `"Masquer les sous-tâches"` when not collapsed;
     `"Voir 1 sous-tâche"` when collapsed and `visibleCount === 1`;
     `` `Voir ${visibleCount} sous-tâches` `` when collapsed and
     `visibleCount > 1`. A non-collapsed or out-of-range input never throws.
   - **Rationale:** the singular/plural rule is the only new logic and is
     trivially unit-testable in Node. Alternative rejected: formatting inline in
     `renderSubstepToggle` (untestable without a DOM).
   - **Note:** the helper is only called when `hasVisibleSubsteps` is true, so
     `visibleCount` is always ≥ 1; the helper still defines a safe result for 0.

2. **Count comes from `view.children.length`, not a new computation.**
   - `renderSubstepToggle(item, view)` reads `view.children.length` and
     `view.collapsed`. `substepView.children` is exactly
     `visibleItems(items, parentId, hideCompleted)` (`site/core.js:43-53`), i.e.
     the direct substeps visible under the current filter, independent of their
     own collapse.
   - **Rationale:** guarantees the label number and the control's presence use
     the same visibility rule; no duplicated filtering logic, no drift. The
     completion filter is respected automatically and the count refreshes on
     every full re-render.

3. **Label text and accessible name.**
   - The button `textContent` is `substepToggleLabel(view.children.length,
     view.collapsed)`. The `aria-label` is that same label followed by the parent
     title, e.g. `label + " de « " + item.title + " »"`, keeping the title as a
     text node only.
   - `aria-expanded` stays `view.collapsed ? "false" : "true"` and
     `aria-controls` stays `substepListId(item.id)` while `view.renderChildren`
     is true; both are unchanged from TS-012.
   - **Rationale:** the acceptance criteria require the accessible name to
     include the new label and the parent title, and require ARIA state and
     `aria-controls` to keep working exactly as before.

4. **No change to state, focus or persistence.**
   - The click handler still calls `toggleCollapsedParent`, sets
     `pendingCollapseFocus` and calls `render()` without `persist()`; the
     `applyFocus` branch and the import reset are untouched.
   - **Rationale:** the label is view-only; reusing the existing control keeps
     non-mutation, transient state and focus continuity guaranteed by TS-012.

5. **Tests and docs.**
   - `tests/core.test.mjs` gains deterministic tests for `substepToggleLabel`
     (expanded label, singular, plural) and for the count derived from
     `substepView` (three direct substeps, one completed → 3 without filter and
     2 with filter; non-mutation of `items` and the collapsed set).
   - `docs/product/guide-utilisation.md` and `docs/product/mvp.md` describe the
     new labels and count. The canonical OpenSpec spec is updated only through
     the OPSX sync after implementation, never during apply.

## Risks / Trade-offs

- **Label and count drift** → avoided by deriving both from the single
  `substepView.children` result; a pure test asserts the 3→2 filter case.
- **Stale count after a child change** → impossible: every mutation calls
  `persist()`/`render()` and the count is recomputed at render time.
- **Longer label in a narrow row** → the button already allows
  `overflow-wrap:anywhere` and a ≥ 44 × 44 px target (`site/styles.css:75-76`);
  no style change is planned, but the mobile rendering is verified during apply.
- **Accessible name length** → the parent title can be up to 300 characters; the
  label remains understandable and the title stays plain text.
- **No DOM harness** → ARIA, focus and text are verified by inspection and
  manual checks plus the pure label tests.

## Migration Plan

None. No schema, version, storage-key or export change. Rollback restores the
previous static labels; stored documents and exports stay valid.

## Open Questions

None that change the specs, approach or task breakdown. The exact
accessible-name connector, the helper name and the defensive zero-count result
are recorded as assumptions in `proposal.md` and are safe to confirm during
review.
