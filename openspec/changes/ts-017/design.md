# Design

## Context

See `proposal.md` — Why. The overview renders every subject through
`renderSubject` and a shared `renderTaskArea` (`site/app.js:490-570`), which lists
`visibleItems(subject.items, null, hideCompleted)` — the existing priority sort
plus the « Masquer les étapes terminées » filter from `site/core.js:86-96`.
TS-016 already added the stable-id detail view, the `#/sujet/<id>` route, the
`openSubject`/`returnToOverview` helpers and the transient focus/reveal flags
(`revealItemId`, `focusItemId`, `openSubject` at `site/app.js:238-244`). The
suggestion card and the resume card reveal a task by setting `revealItemId` and
`focusItemId` and re-rendering (`revealSuggestion` at `site/app.js:352-356`,
`revealResume` at `site/app.js:385-389`), and `applyFocus` looks the item up in
the rendered `#subjects` (`site/app.js:276-285`). There is no DOM test harness:
automated tests are Node tests that either import `site/core.js` or read static
files as text. Constraints: browser-only, no new dependency or storage key, no
schema/route change, French accessible UI, no mutation during presentation.

## Goals / Non-Goals

**Goals:**

- A pure, non-mutating preview selector in `site/core.js` that returns the first
  five visible top-level tasks and whether more remain, reusing the existing
  sort and filter.
- A `renderTaskArea` option used only by the overview, leaving the detail view
  unlimited.
- Reveal shortcuts that open the detail view when the target is not among the
  previewed five, reusing the existing transient flags and route.
- Provable presentation-only behavior: no `persist()` call on any preview, route
  or reveal path.

**Non-Goals:**

- A DOM test harness, a framework or a rewritten renderer.
- A route parameter, new persistence, new storage key or document field.
- Changing suggestion/resume selection, detail-view rendering or any business
  function.

## Decisions

1. **Pure preview selector in `site/core.js`.**
   - `OVERVIEW_TASK_LIMIT = 5`.
   - `overviewPreview(items, hideCompleted = false, limit = OVERVIEW_TASK_LIMIT)`
     returns `{ shown, hasMore }`: `shown` is `visibleItems(items, null,
     hideCompleted).slice(0, safeLimit)` and `hasMore` is `visible.length >
     shown.length`. `safeLimit` falls back to 5 for a non-integer or negative
     limit.
   - `isWithinOverviewPreview(items, itemId, hideCompleted = false)` returns
     whether `itemId` is one of the previewed top-level entries.
   - **Rationale:** `visibleItems` already applies priority sort, stable manual
     order and the completion filter, and returns a new array, so `slice` and the
     helpers never mutate `subject.items`. Only `parentId: null` items are
     counted, so substeps never consume a slot. Alternatives rejected: limiting
     inside `renderTaskArea` only (not unit-testable) and a `findIndex`-based
     helper (more code, same behavior).

2. **One preview option on the shared task area.**
   - `renderTaskArea(subject, { preview = false } = {})` builds `topLevel` from
     `overviewPreview` when `preview` is true, otherwise from the existing
     `visibleItems(items, null, hideCompleted)` with `hasMore: false`. It loops
     the resulting `shown` entries through the existing `renderItem` (which still
     renders each shown parent's visible substeps via `substepView`) and appends
     the single « Voir plus » control only when `hasMore` is true.
   - `renderSubject` calls `renderTaskArea(subject, { preview: true })`;
     `renderDetailView` keeps `renderTaskArea(subject)`, so the detail view is
     unchanged and unlimited.
   - **Rationale:** one code path keeps overview and detail rendering identical
     for tasks and substeps; the option localizes the only behavioral difference.

3. **Single « Voir plus » control opening the existing route.**
   - Reuse `openSubject(subject)`, which already sets `focusDetailHeading` and
     calls `navigate(subjectRoute(subject.id))`. The control is a native
     `<button class="secondary overview-see-more">` with the text « Voir plus »
     and `aria-label` « Voir plus de tâches pour le projet <titre> ».
   - **Rationale:** identical history, return and focus behavior to
     « Ouvrir le projet », and no route change. Alternatives rejected: a second
     custom link and a header-level control (the header keeps « Ouvrir le
     projet »).

4. **Reveal shortcuts navigate to the detail view when the target is hidden.**
   - Add `revealAction(subjectId, itemId)`. When the subject exists and
     `isWithinOverviewPreview(subject.items, itemId, hideCompleted)` is false, set
     `revealItemId = itemId`, `focusItemId = itemId`, clear `renamingSubject`/
     `focusDetailHeading` and `navigate(subjectRoute(subjectId))`. Otherwise set
     the same flags and `render()`.
   - `revealSuggestion(suggestion)` and `revealResume(view)` call it with the
     subject and item ids. In the detail view all top-level tasks are rendered, so
     `applyFocus` finds the target, focuses its edit control and scrolls it into
     view; `renderItem` marks it with the existing `reveal` class.
   - **Rationale:** the flags are already consumed by `applyFocus` and
     `renderItem`, so no route parameter or persistence is needed. Alternatives
     rejected: a query/fragment parameter (new route grammar) and relocating the
     preview limit into the DOM after reveal (would break the quota).

5. **Empty state and counter unchanged.**
   - Keep the existing `if (!subject.items.length)` empty message and the
     subject-local pending count over the full `subject.items`, independent of the
     preview. Only rendering is limited.
   - **Rationale:** preserves today's observable behavior and the acceptance
     criterion that existing counters stay based on the complete document.

6. **Styles and static coverage.**
   - `.overview-see-more` gets `min-height: 44px; min-width: 44px`, consistent
     spacing and focus styling from the existing rules. No animation is added.
   - `tests/core.test.mjs` covers bounds 0/1/5/6, filter-before-limit, substeps
     not consuming a slot, project independence and non-mutation. A new
     `tests/overview-preview.test.mjs` reads `site/app.js` and `site/styles.css`
     as text and asserts the preview option, the « Voir plus » label/aria-label,
     the reveal-navigation branch and the ≥ 44 px touch target. Static
     assertions complement, but do not replace, manual touch/visual acceptance.
   - **Rationale:** the project has no DOM harness; static text checks are the
     existing pattern (e.g. `tests/factory-openspec.test.mjs`), and pure tests
     carry the behavioral guarantees.

## Risks / Trade-offs

- **Task moved out of the five loses post-move focus.** → Acknowledged in
  `proposal.md`; the move still persists correctly and no error occurs. Kept out
  of scope to avoid inventing behavior.
- **Reveal path could target a filtered-out task.** → Suggestion and tracking
  only reference unfinished top-level tasks, which stay visible under
  « Masquer les étapes terminées »; `revealAction` also falls back to the
  overview when the subject is missing.
- **Detail view accidentally limited.** → `renderTaskArea` defaults to no limit
  and only the overview passes `preview: true`; a static test asserts the detail
  call keeps the default.
- **Canonical spec drift.** → The change adds one new capability and only ADDs
  new requirements to two existing capabilities; a post-sync review confirms no
  other canonical spec changed.
- **Static tests mistaken for acceptance.** → The manual acceptance section of
  `tasks.md` records the remaining touch/keyboard/visual checks without
  checkboxes; no automated assertion is presented as user validation.

## Migration Plan

None. No schema, version, storage-key, route or export/import change is made.
Rollback removes the preview option, the « Voir plus » control and the reveal
branch and leaves every stored document and export valid.

## Open Questions

None that change the specs, the approach or the task breakdown. The empty-state
condition, the out-of-quota reorder focus and the exact « Voir plus » wording are
recorded as uncertainties in `proposal.md` and are safe to confirm during review.
