# Proposal

## Why

Today every overview project card renders all of its visible top-level tasks, so
a subject with many steps makes the dashboard dense and pushes other cards away.
TS-017 keeps each card compact with a five-entry preview and a single « Voir plus
» path to the full detail view built by TS-016, while the tracking and suggestion
shortcuts keep reaching tasks that the preview no longer renders.

## What Changes

- Limit the overview card of each subject to the **first five visible top-level
  tasks** (`parentId: null`) in the existing order (priority, then manual order),
  after the existing « Masquer les étapes terminées » filter is applied. A
  top-level task and its direct substeps count as one preview entry; substeps
  never consume a preview slot.
- Add a single French « Voir plus » control per card when more than five visible
  top-level tasks remain; it opens the existing stable-id detail route
  `#/sujet/<id>` of the correct project with the existing history, return and
  focus behavior. The detail view keeps its current behavior and applies **no**
  five-task limit.
- Keep the existing « Ouvrir le projet » header control and the existing pending
  counter unchanged.
- Make the tracking and suggestion shortcuts (« Je reprends ici » and
  « Une étape pour maintenant » → « Voir dans la liste ») deterministic when the
  target task is beyond the five previewed entries: open the detail view of the
  correct project and reveal the task there instead of targeting an element that
  is not in the overview DOM.
- Ensure preview tasks beyond the quota are absent from the overview DOM, cannot
  receive focus and are neither drag sources nor drop targets in that view.
- **BREAKING**: none. No document, storage key, JSON shape or route change.
- Update the canonical specs and the product documentation (user guide, MVP),
  with deterministic Node tests for the pure preview selection and for the
  preview/reveal wiring.

## Capabilities

### New Capabilities

- `subject-overview-preview`: limits each overview project card to the first five
  visible top-level tasks after sort and filter and offers a single accessible
  « Voir plus » control that opens the existing full detail route; it is
  presentation-only and exposes no hidden preview entry to focus or drag.

### Modified Capabilities

- `next-action-suggestion`: adds the requirement that locating a suggested action
  which is not among the five previewed entries opens the detail view of its
  subject and reveals the action there, never targeting an absent element.
- `resume-tracking`: adds the requirement that locating a tracked action which is
  not among the five previewed entries opens the detail view of its subject and
  reveals the action there, never targeting an absent element.

## Impact

- `site/core.js`: add a pure, non-mutating preview selector
  (`overviewPreview`) and a small membership helper (`isWithinOverviewPreview`)
  reusing the existing `visibleItems` sort and filter; no change to existing
  domain functions.
- `site/app.js`: give `renderTaskArea` a preview option, render the single
  « Voir plus » control, and route the reveal shortcuts through a shared helper
  that navigates to the subject detail when the target is beyond the preview.
- `site/styles.css`: styling and ≥ 44 × 44 px touch target for « Voir plus ».
- `tests/core.test.mjs`: deterministic cases for the pure preview selector.
- `tests/overview-preview.test.mjs` (new): static assertions over `site/app.js`
  and `site/styles.css` for the preview wiring, accessible name and touch target;
  these are not a substitute for manual touch/visual acceptance.
- `docs/product/guide-utilisation.md` and `docs/product/mvp.md`: describe the
  preview limit, the « Voir plus » control and the shortcut behavior (FR-20).
- Unchanged: document schema and version, `threadstep.document.v1`,
  `threadstep.resume.v1`, JSON shape, routes, dependencies, network, workflows,
  `AGENTS.md`, `backlog/` and `docs/factory/`.

## Non-Goals / Out of Scope

- Pagination, network loading, a five-task limit inside the detail view, changing
  the total number of stored tasks, automatic archiving, or a second preview
  control.
- Any change to the detail view, rename, task editing, ordering, collapse,
  removal, priority, suggestion selection or tracking selection logic.
- Any new data field, storage key, document version or migration.

## Unresolved Decisions / Uncertainties

- **Filtered-empty card.** Planned: keep the existing empty state, which is shown
  only when a subject has no task at all. A subject whose tasks are all hidden by
  « Masquer les étapes terminées » continues to show an empty list without a new
  message, as today. This is a presentation detail open to review.
- **Reorder that pushes a previewed task past the quota.** Planned: no new
  behavior. Moving a task down can move it out of the five previewed entries, so
  it simply stops being rendered and may lose the post-move focus; the existing
  business ordering and persistence are unaffected. Confirming the desired focus
  behavior is a review detail.
- **Exact wording and placement of « Voir plus ».** Planned: a single French
  button below the card's task list, with the accessible name
  « Voir plus de tâches pour le projet <titre> ». The final label and styling are
  review details.
- **Reveal mechanics for a hidden target.** Planned: reuse the existing
  transient `revealItemId`/`focusItemId` flags and the TS-016 detail route, so the
  target is revealed in the detail view without adding a route parameter or any
  persistence. Reloading during the reveal returns to the plain detail view.
