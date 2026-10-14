# Tasks

## 1. Pure selector in `site/core.js`

- [x] 1.1 Add a pure `nextActionSuggestion(document)` to `site/core.js` that
  returns `{ subjectId, subjectTitle, itemId, itemTitle, priority }` for the
  eligible unfinished top-level action with the minimum
  `(priorityIndex, subjectIndex, itemIndex)`, or `null` when none exists, and
  never mutates its input; verify with `node --check site/core.js`.
- [x] 1.2 Add unit tests in `tests/core.test.mjs` proving urgent wins across
  subjects, priority dominates later subject order, subject order breaks a
  priority tie, and raw item order breaks a within-subject tie; verify with
  `npm test`.
- [x] 1.3 Add unit tests proving exclusion and the empty case: a completed
  top-level action, substeps, a completed parent with an unfinished child,
  only-substeps and an empty document all yield no candidate (`null`); verify
  with `npm test`.
- [x] 1.4 Add unit tests proving the selector leaves the input document deep-
  equal to a snapshot and returns the same candidate on repeated calls; verify
  with `npm test`.

## 2. Suggestion control and card

- [x] 2.1 Add a French « Une étape pour maintenant » control near `#counter` in
  `site/index.html` and a dedicated `aria-live` region for the card; verify the
  control is focusable, named and visible.
- [x] 2.2 In `site/app.js`, recompute `nextActionSuggestion(documentState)` on
  each activation and render a compact, non-modal card with the subject name,
  title and priority using text nodes only; verify a title containing markup is
  shown literally and no second action appears.
- [x] 2.3 Render a friendly French empty state when the selector returns no
  candidate, and add a « Fermer » control that hides the card without writing
  storage; verify both paths by keyboard.
- [x] 2.4 Add control, card and empty-state styles in `site/styles.css`; verify
  layout and readability at a mobile viewport with no new dependency.

## 3. Reveal and accessibility

- [x] 3.1 Wire « Voir dans la liste » to scroll the suggested action into view,
  apply a visible highlight and move focus to that action's existing
  « Modifier » control, reusing the `focusItemId`/`applyFocus()` pattern; verify
  with keyboard-only navigation and by touch.
- [x] 3.2 Verify reveal still resolves the action when « Masquer les étapes
  terminées » is enabled, since the suggested action is unfinished and rendered.
- [x] 3.3 Verify the card and its controls are keyboard reachable, announced via
  the live region and usable at a mobile viewport.

## 4. Product documentation

- [x] 4.1 Update `docs/product/mvp.md` (FR-12 and acceptance tests) to state the
  deterministic ranking, top-level-only eligibility, view-only/non-persistent
  behavior and its limits, without touching `docs/factory/`; verify the text
  matches the implemented UI.

## 5. Integration verification

- [x] 5.1 Verify that activating the control and using reveal writes nothing:
  compare `localStorage` (`threadstep.document.v1`), ids, done flags,
  priorities, item order, subject order and a fresh JSON export before and
  after; confirm a reload restores no card.
- [x] 5.2 Run `npm run check` and
  `openspec validate ts-007 --strict --no-interactive`; report the exact
  commands and their output.

## Workflow follow-up

- Do not archive during implementation; archive only through the project's
  reviewed process after every tracked task is checked.
- Confirm no protected path (`AGENTS.md`, workflows, `backlog/*`,
  `docs/factory/*`, config, secrets) changed and independent CI passes before
  merge.
