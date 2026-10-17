# Tasks

## 1. Pure preview selection in `site/core.js`

- [x] 1.1 Add `OVERVIEW_TASK_LIMIT = 5`, `overviewPreview(items, hideCompleted =
  false, limit = OVERVIEW_TASK_LIMIT)` returning `{ shown, hasMore }` from the
  existing `visibleItems(items, null, hideCompleted)` sorted/filtered list (with
  a safe default when `limit` is not a non-negative integer), and
  `isWithinOverviewPreview(items, itemId, hideCompleted = false)`; verify with
  `node --check site/core.js`.
- [x] 1.2 Add deterministic `tests/core.test.mjs` cases for `overviewPreview`:
  0/1/5/6 visible top-level tasks with the `0/1/5/5` split and the expected
  `hasMore`, the completed filter applied before the limit (a filtered task
  consumes no slot), direct substeps not consuming a slot, two subjects limited
  independently, an invalid `limit` falling back to five, and no mutation of
  `subject.items`; verify with `npm test`.
- [x] 1.3 Add deterministic `tests/core.test.mjs` cases for
  `isWithinOverviewPreview` proving a previewed top-level id is inside, an id
  beyond the five is outside, the result follows the completion filter, and the
  helper never mutates its input; verify with `npm test`.

## 2. Overview rendering and « Voir plus » in `site/app.js`

- [x] 2.1 Add a `{ preview = false }` option to `renderTaskArea` that builds the
  top-level list from `overviewPreview` when enabled and otherwise keeps the
  existing `visibleItems` list; call it with `{ preview: true }` only from
  `renderSubject`, leaving the detail view on the unlimited default; verify with
  `node --check site/app.js`.
- [x] 2.2 Render exactly one native `<button class="secondary overview-see-more">`
  labelled « Voir plus » with the accessible name « Voir plus de tâches pour le
  projet <titre> », appended only when `hasMore` is true and wired to the existing
  `openSubject`/`#/sujet/<id>` route; verify with `node --check site/app.js`.

## 3. Deterministic reveal shortcuts in `site/app.js`

- [x] 3.1 Add a `revealAction(subjectId, itemId)` helper that sets the existing
  `revealItemId`/`focusItemId` flags, and when the subject exists and the item is
  outside `isWithinOverviewPreview` navigates to the correct `subjectRoute`
  instead of re-rendering the overview; route `revealSuggestion` and
  `revealResume` through it; verify with `node --check site/app.js`.
- [x] 3.2 Add deterministic `tests/core.test.mjs` cases proving the reveal
  decision input is correct on a document with more than five top-level tasks:
  `isWithinOverviewPreview` is true for each of the five previewed ids and false
  for the sixth, including after a priority change reorders the groups; verify
  with `npm test`.

## 4. Styles and static accessibility assertions

- [x] 4.1 Add `.overview-see-more` styling in `site/styles.css` with a minimum
  44 × 44 px target, the existing focus-visible treatment and no new animation,
  and a static assertion in `tests/overview-preview.test.mjs`; verify with
  `npm test`.
- [x] 4.2 Add static assertions in `tests/overview-preview.test.mjs` reading
  `site/app.js` as text for the `renderTaskArea` preview option, the unlimited
  detail call, the single `.overview-see-more` control, its literal « Voir plus »
  label and project-naming `aria-label`, and the reveal navigation branch; verify
  with `npm test`. These static checks do not replace manual touch/visual
  acceptance.

## 5. Product documentation

- [x] 5.1 Update `docs/product/guide-utilisation.md` with a section describing the
  five-entry preview after the existing sort and filter, the single « Voir plus »
  control opening the detail view, and the tracking/suggestion shortcuts reaching
  tasks beyond the preview; verify the section matches the shipped behavior and
  that `npm run check` still passes.
- [x] 5.2 Update `docs/product/mvp.md` to add the preview-limit requirement and
  its matching acceptance test (FR-20), noting the detail view stays unlimited and
  that counters, export and localStorage are unchanged; verify the text matches
  the shipped behavior and that `npm run check` still passes.

## 6. Integration verification

- [x] 6.1 Run `npm run check` and report the exact command and its output.
- [x] 6.2 Run `openspec validate ts-017 --strict --no-interactive` and report the
  exact command and its output.

## Post-sync review

- After the OpenCode OPSX sync, diff the canonical
  `openspec/specs/subject-overview-preview/spec.md`,
  `openspec/specs/next-action-suggestion/spec.md` and
  `openspec/specs/resume-tracking/spec.md` against their deltas and confirm the
  `## Purpose` (new capability only), requirements and scenarios were copied
  without loss, duplication or rewording, and that the strict description-length
  check passes.
- Confirm every other canonical spec under `openspec/specs/` is byte-identical to
  its prior revision, since this change adds one capability and only new
  requirements to two existing capabilities.
- Verify the OPSX content-scope guard, the OpenSpec archive step and the
  independent PR CI `check`; a reviewer must approve the semantic diff before
  merge.
- Verify the GitHub Pages deployment and manually test the preview, « Voir plus »,
  return, history and reload with a finger on a smartphone and at the keyboard,
  and confirm no new browser-storage key appears.
- These assertions cannot be ticked by apply before the sync has run.

## Manual acceptance

- With a real browser, verify the 0/1/5/6 visible-task limits, the « Voir plus »
  control, the detail entry, the return control, browser history and reload.
- Verify by keyboard, mouse, touch, on a phone and with available assistive
  technology: focus, accessible names naming the project, absence of any
  out-of-preview target, filters and task moves.
- Verify without presuming the result that navigation, filtering and the quota
  write neither the document, nor localStorage, nor the exported JSON, and
  document any deviation.
- Examine the differences after the OpenSpec sync and archive, then the
  independent PR CI and post-merge results. No claim recorded here counts as
  validation until it has actually been run.

## Workflow follow-up

- Do not archive during implementation; sync and archive only through the
  project's reviewed process after every tracked task is checked and strict
  validation passes.
- Confirm no protected path changed and that independent CI passes before merge.
- This plan authorizes no paid model run, no apply, no merge and no archive.
