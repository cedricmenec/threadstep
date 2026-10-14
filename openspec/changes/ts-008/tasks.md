# Tasks

## 1. Pure resume helpers in `site/core.js`

- [ ] 1.1 Add `RESUME_KEY = "threadstep.resume.v1"`, a pure
  `parseResumePreference(raw)` returning `{ subjectId, itemId }` or `null`, a
  pure `serializeResumePreference(ref)`, and a pure `resumeView(document, ref)`
  returning `{ subjectId, subjectTitle, itemId, itemTitle, priority }` only for an
  existing unfinished top-level action (`parentId === null && done === false`) in
  an existing subject, else `null`; never mutate the input. Verify with
  `node --check site/core.js`.
- [ ] 1.2 Add unit tests in `tests/core.test.mjs` proving
  `parseResumePreference` accepts a valid stored reference and rejects `null`,
  malformed JSON, non-objects and empty/oversized identifiers, and that
  `serializeResumePreference` round-trips through `parseResumePreference`. Verify
  with `npm test`.
- [ ] 1.3 Add unit tests proving `resumeView` resolves an unfinished top-level
  action with the right subject name, title and priority, and returns `null` for
  a completed action, a substep, a missing action, a missing subject and an empty
  reference; also prove it leaves the input document deep-equal to a snapshot.
  Verify with `npm test`.
- [ ] 1.4 Add unit tests proving selection is unique and replaceable (one parsed
  reference resolves to exactly one action; a different reference resolves to the
  other one), that a reload is simulated by a
  `serializeResumePreference` → `parseResumePreference` → `resumeView` round-trip,
  and that `nextActionSuggestion` is unaffected by the presence or absence of a
  resume reference (TS-007 independence). Verify with `npm test`.

## 2. Local preference lifecycle in `site/app.js`

- [ ] 2.1 Add in-memory `resumeRef` and a `documentLoaded` flag; read and
  `parseResumePreference` `RESUME_KEY` during `load()`, and call
  `reconcileResume()` after a successful load, after the import replacement and
  inside `render()`. On an orphaned reference, set `resumeRef = null` and
  `localStorage.removeItem(RESUME_KEY)`; verify by pinning an action, reloading
  and inspecting `localStorage` shows the card restored under `RESUME_KEY` only.
- [ ] 2.2 Verify cleanup end to end: completing the tracked action, removing the
  tracked action and removing its subject each remove the `RESUME_KEY` entry and
  hide the card with no error, and importing a valid document without the tracked
  action clears the reference. Confirm no orphan key remains after each case.
- [ ] 2.3 Verify tracking survives renaming, a priority change and subject
  reordering: pin an action, edit it or reorder its subject, reload, and confirm
  the same action is still tracked and the card shows the updated title,
  priority and subject. Confirm the document's ids, flags, priorities and both
  orders are byte-identical to a pre-edit export.

## 3. Pin control on eligible actions

- [ ] 3.1 In `renderActions`, render an enabled French « Garder le fil » control
  only for unfinished top-level actions, with an `aria-label` naming the action;
  render no control for completed top-level actions or substeps. Verify by
  keyboard and by inspecting the generated controls.
- [ ] 3.2 Wire the control to replace any previous reference: set
  `resumeRef`, write `localStorage.setItem(RESUME_KEY, serializeResumePreference(...))`,
  and re-render. Render the currently tracked action's control as the announced
  disabled status « Action suivie » (accessible name naming the action). Verify
  that defining A shows one card, defining B replaces A, and no action's id,
  priority, done flag, parent relation or order changed.
- [ ] 3.3 Verify the control's user text is rendered as text nodes (a title with
  markup such as `<img src=x onerror=alert(1)>` is shown literally and creates no
  element), and that the control is reachable and operable by keyboard and by
  touch at a mobile viewport.

## 4. Resume card and accessible reveal

- [ ] 4.1 Add a `#resume-card` region as the first block of the dashboard in
  `site/index.html` with `aria-live="polite"` and `hidden` by default, and add
  card/control styles in `site/styles.css`; verify the region is above the
  unfinished counter and the subject lists and remains readable at a mobile
  viewport.
- [ ] 4.2 Implement `renderResumeCard()` to show exactly one card titled
  « Je reprends ici » with the subject name, action title and priority, plus
  « Voir dans la liste » and « Ne plus suivre », building text with the existing
  `el()` helper and `textContent` only; keep the card hidden when
  `reconcileResume()` returns no view model. Verify the card content, the empty
  case and safe text rendering.
- [ ] 4.3 Wire « Voir dans la liste » to reuse the existing reveal path (set
  `revealItemId` and `focusItemId`, then `render()` → `applyFocus()`). Verify by
  keyboard that the tracked action is scrolled into view, highlighted and
  focused, including on mobile and when « Masquer les étapes terminées » is
  enabled.
- [ ] 4.4 Wire « Ne plus suivre » to set `resumeRef = null`, remove
  `RESUME_KEY`, clear `revealItemId` and re-render without calling `persist()`;
  verify no card is shown, the action is unchanged and a reload shows no card.

## 5. Product documentation

- [ ] 5.1 Update `docs/product/mvp.md` FR-13 and the acceptance tests to match
  the delivered behavior (single tracked top-level action, separate browser-local
  preference excluded from exports, reload restore, accessible reveal, clear and
  automatic cleanup). Verify the text matches the implemented UI and that no
  `docs/factory/` file, workflow, config or backlog file was changed.

## 6. Integration verification

- [ ] 6.1 Verify JSON export/import compatibility: export before and after
  pinning an action and confirm the JSON is byte-identical and contains no
  tracking field; confirm the reference is stored under `RESUME_KEY` and not
  `threadstep.document.v1`; confirm a pre-change export file is still accepted by
  `parseDocument`.
- [ ] 6.2 Verify TS-007 independence observably: with an action tracked, request
  the suggestion and confirm the tracked action and its card are unchanged; then
  define and clear tracking and confirm the suggestion still reflects only the
  current document state.
- [ ] 6.3 Run `npm run check` and
  `openspec validate ts-008 --strict --no-interactive`; report the exact commands
  and their output, and state that no other tracked task remains unchecked.

## Workflow follow-up

- Do not archive during implementation; archive only through the project's
  reviewed process after every tracked task is checked and validation is strict.
- Confirm no protected path (`AGENTS.md`, workflows, `backlog/*`,
  `docs/factory/*`, `opencode.json`, config, secrets) changed and that independent
  CI passes before merge.
- Opening or updating this change is planning only; it authorizes no paid model
  run, no apply, no merge and no archive.
