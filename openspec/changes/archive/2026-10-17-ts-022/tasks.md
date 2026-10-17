# Tasks

## 1. Pure promotion operation in `site/core.js`

- [x] 1.1 Add a pure, immutable `promoteItemToTopLevel(document, subjectId, itemId)` and a `canPromoteItemToTopLevel(document, subjectId, itemId)` predicate to `site/core.js` that set only the targeted item's `parentId` to `null` in its same subject and insert it in `subject.items` immediately after its former parent, preserving `id`, `title`, `priority`, `done`, the optional `note` and every other field; verify with deterministic Node unit tests in `tests/core.test.mjs`.
- [x] 1.2 Add deterministic Node tests to `tests/core.test.mjs` covering field preservation with note/priority/done, unchanged `id` and no new id, insertion immediately after the former parent, unchanged relative order of the other elements, unchanged priorities, siblings still attached, no duplication, and no mutation of the input document or arrays; run `node --test tests/core.test.mjs` and report the result.
- [x] 1.3 Add deterministic Node tests to `tests/core.test.mjs` for the refusal and no-op invariants: an unknown subject or item id, an already top-level item, a missing or incoherent parent and replaying a completed promotion all return the same document reference; run `node --test tests/core.test.mjs` and report the result.

## 2. App wiring: command, single save and reveal

- [x] 2.1 Render a French « Promouvoir en tâche principale » `type="button"` control on every direct substep and never on a top-level task in the shared `renderActions` path of `site/app.js`, reusing `promoteItemToTopLevel` without duplicating domain logic, with an accessible name naming the substep; verify with deterministic static-assertion tests reading `site/app.js` and `node --check site/app.js`.
- [x] 2.2 On activation call `persist()` exactly once only when the returned document differs from the current one, then route the promoted task through the existing `revealAction`/`focusItemId` path so focus lands on it and the detail route opens when it is outside the overview five-entry preview; verify with deterministic Node assertions over the core result plus static assertions on the app wiring and the single `persist()` call.
- [x] 2.3 Add the deterministic app-wiring test to the `tests/` suite asserting the control label and its substep-only condition, the reuse of `promoteItemToTopLevel`, one `persist()` on success, no `persist()` on a refused promotion and the absence of `.innerHTML`; run `node --test tests/*.test.mjs` and report the result.

## 3. Cross-feature coherence tests

- [x] 3.1 Add deterministic Node tests that a promotion increases `totalTaskCount` by one while `pendingCount` is unchanged, and that an unfinished promoted task becomes eligible for `nextActionSuggestion`, using the promoted document; run `node --test tests/*.test.mjs` and report the result.
- [x] 3.2 Add deterministic Node tests that `planRemoval` of the former parent keeps the promoted task because its `parentId` is now `null`, and that `parseDocument(JSON.stringify(promotedDocument))` round-trips with version 1 and the promoted `parentId: null`; run `node --test tests/*.test.mjs` and report the result.
- [x] 3.3 Add deterministic Node tests that promotion preserves an item's optional note and its line breaks and that `updateItem`, `setItemPriority` and `reorderWithinPriority` still operate on the promoted top-level task without changing its `parentId`; run `node --test tests/*.test.mjs` and report the result.
- [x] 3.4 Add deterministic Node tests that a former parent with no remaining visible substep yields no disclosure control from the existing `substepView` helper after a promotion; run `node --test tests/*.test.mjs` and report the result.

## 4. Final gate

- [x] 4.1 Run `npm run check` and `openspec validate ts-022 --strict --no-interactive`, report the exact commands and their real output, and do not mark any earlier task complete if either fails.

## Manual acceptance

- In a real desktop and mobile browser, promote a finished and an unfinished substep, each with and without a note and with a non-default priority, and confirm every field is preserved except `parentId`, now `null`, and that the task appears as a top-level task of the same project.
- Promote two substeps of the same parent and confirm the other children stay attached, the order is stable, no duplicate appears, and removing the former parent keeps the promoted tasks.
- Operate the « Promouvoir en tâche principale » control with mouse, touch, Tab, Enter and Space in both the overview and the detail view, confirm the visible focus indicator, the ≥ 44 × 44 px touch target and the accessible name naming the substep, and confirm focus is restored on the promoted task, including when it must be revealed through the detail view because it falls outside the five overview entries.
- Confirm the top-level total increases by one, the pending counter is unchanged, and the suggestion, the « Je reprends ici » tracking, the completed filter and the five-entry preview reflect the new hierarchy; check the reported edge where a promoted task hidden by « Masquer les étapes terminées » exposes no element to focus until the filter is cleared.
- Check with a screen reader that the control and the promoted task are announced in French and that user titles are read as text.
- Reload the page, then export the JSON and re-import it, and confirm the promotion survives with the same `threadstep.document.v1` key, version 1 and no new storage key.
- These are pending human acceptance, not completed by any green Node test, and contain no checkbox.

## Post-sync review

- After the separate OPSX semantic sync step, compare the canonical deltas for `substep-promotion` and `substep-ordering` against the intended ADDED and MODIFIED behavior, including that only the « No re-parenting or level change » requirement changed.
- Check the archived OpenSpec change and its versioned content.
- After the PR is published, verify the independent GitHub `check` job on the exact head SHA, the required branch protection, the merge evidence and post-merge CI / GitHub Pages deployment.
- This stage is external to `apply`; these reviews contain no checkbox and must never be marked complete before their evidence exists.
