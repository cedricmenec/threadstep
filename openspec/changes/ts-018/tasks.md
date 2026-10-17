# Tasks

## 1. Pure count and label in `site/core.js`

- [ ] 1.1 Add `totalTaskCount(items)` returning the number of items with
  `parentId === null` (safe `0` for a non-array input, never mutating or sorting)
  and `totalTaskCountLabel(count)` returning « 0 tâche au total », « 1 tâche au
  total » or « N tâches au total » with the French singular for 0 and 1 and a
  normalized `0` for a non-finite or negative input; verify with
  `node --check site/core.js`.
- [ ] 1.2 Add deterministic `tests/core.test.mjs` cases for `totalTaskCount` and
  `totalTaskCountLabel`: 0/1/3 top-level tasks, a parent with substeps counting
  once, a completed top-level task still counted, the 0/1 singular and N > 1
  plural labels, an invalid input normalizing to « 0 tâche au total », and no
  mutation of the input array; verify with `npm test`.

## 2. Overview card header rendering

- [ ] 2.1 Import `totalTaskCount` and `totalTaskCountLabel` in `site/app.js` and,
  in `renderSubject`, append a `small subject-total` text line built from them to
  the existing `titleBox` after the pending line, leaving the pending line
  byte-identical; verify with `node --check site/app.js`.
- [ ] 2.2 Add `tests/task-total.test.mjs` reading `site/app.js` as text and
  asserting `renderSubject` calls `totalTaskCount(subject.items)` and
  `totalTaskCountLabel(...)`, that the existing
  `pending + " étape" + (pending > 1 ? "s" : "") + " en attente"` string is still
  present, and that the total is built with `el("p", ...)` text and no
  `innerHTML`; verify with `npm test`.

## 3. Detail header rendering

- [ ] 3.1 In `renderDetailHead`, append the same `small subject-total` line after
  the existing pending line, leaving the pending line, the route, the return and
  rename controls and the navigation unchanged; verify with
  `node --check site/app.js`.
- [ ] 3.2 Extend `tests/task-total.test.mjs` to assert the `renderDetailHead`
  total call and that its existing pending string is unchanged; verify with
  `npm test`.

## 4. Invariance and document-change tests

- [ ] 4.1 Add deterministic `tests/core.test.mjs` cases proving `totalTaskCount`
  is invariant under `visibleItems(items, null, hideCompleted)` and
  `overviewPreview(items, hideCompleted)` with and without the completion filter,
  under a collapsed substep list and under the five-entry preview limit, and that
  it changes correctly after `planRemoval`/`restoreRemoval`, an add, a reorder
  via `reorderWithinPriority` and a `parseDocument` import roundtrip; verify with
  `npm test`.

## 5. Styles and static accessibility assertions

- [ ] 5.1 Add `.subject-total` styling in `site/styles.css` reusing the existing
  `.small` look with a wrap rule (`overflow-wrap:anywhere`) for narrow headers,
  no colour-only signalling and no animation; add a static assertion in
  `tests/task-total.test.mjs`; verify with `npm test`.

## 6. Product documentation

- [ ] 6.1 Update `docs/product/guide-utilisation.md` with a short section
  describing the total label, its independence from the completion filter, the
  substep collapse and the five-entry preview, and the preserved
  « N étape(s) en attente » counter; verify the text matches the shipped behavior
  and that `npm run check` still passes.
- [ ] 6.2 Update `docs/product/mvp.md` to add FR-21 and its matching acceptance
  test (total of top-level tasks, completed included, substeps excluded, pending
  counter unchanged, no new field, key or migration); verify the text matches the
  shipped behavior and that `npm run check` still passes.

## 7. Integration verification

- [ ] 7.1 Run `npm run check` and report the exact command and its output.
- [ ] 7.2 Run `openspec validate ts-018 --strict --no-interactive` and report the
  exact command and its output.

## Post-sync review

- After the OpenCode OPSX sync, diff the new canonical
  `openspec/specs/subject-task-total/spec.md` and the canonical
  `openspec/specs/subject-detail-view/spec.md` against their deltas and confirm
  the `## Purpose` (new capability only), requirements and scenarios were copied
  without loss, duplication or rewording, and that the strict
  description-length check passes.
- Confirm every other canonical spec under `openspec/specs/` is byte-identical to
  its prior revision, since this change adds one capability and only one new
  requirement to an existing capability.
- Verify the OPSX content-scope guard, the OpenSpec archive step and the
  independent PR CI `check`; a reviewer must approve the semantic diff before
  merge. These assertions cannot be ticked by apply before the sync has run.

## Manual acceptance

- With a real browser on desktop and mobile, examine the placement, legibility
  and reading order of the total in the header, without relying on colour alone.
- Verify visually the updates during real interactions (add, complete, remove,
  undo, import, reorder) and the distinction from the pending count.
- Check the independent PR results, the post-sync spec coherence and the
  post-merge behavior. No claim recorded here counts as validation until it has
  actually been run.

## Workflow follow-up

- Do not archive during implementation; sync and archive only through the
  project's reviewed process after every tracked task is checked and strict
  validation passes.
- Confirm no protected path changed and that independent CI passes before merge.
- This plan authorizes no paid model run, no apply, no merge and no archive.
