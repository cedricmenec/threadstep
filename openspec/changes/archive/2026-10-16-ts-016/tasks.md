# Tasks

## 1. Pure routing and subject lookup in `site/core.js`

- [x] 1.1 Add `subjectRoute(subjectId)` returning the canonical fragment
  `"#/sujet/" + encodeURIComponent(subjectId)` for a valid id (non-empty string,
  length ≤ 100) and `null` otherwise, and `parseRoute(hash)` returning
  `{ view: "overview" }` for empty/unrelated fragments, `{ view: "subject",
  subjectId }` for a valid `#/sujet/<id>`, and `{ view: "invalid" }` for a
  malformed subject fragment without throwing. Verify with `node --check
  site/core.js`.
- [x] 1.2 Add `findSubject(document, subjectId)` returning the matching subject
  reference or `null` without mutating or copying the document. Verify with
  `node --check site/core.js`.
- [x] 1.3 Add deterministic `tests/core.test.mjs` cases for `subjectRoute` and
  `parseRoute`: round-trip of a valid id (including an id with URL-special
  characters), an empty/`#`/`#/`/unrelated fragment mapping to `overview`, a
  malformed `#/sujet/` mapping to `invalid`, and `null`/non-string input mapping
  to `overview`. Verify with `npm test`.
- [x] 1.4 Add deterministic `tests/core.test.mjs` cases proving navigation
  without mutation: `findSubject` returns the identical subject reference for a
  present id and `null` for an absent id, and neither `parseRoute` nor
  `findSubject` mutates its input. Verify with `npm test`.

## 2. Pure subject rename in `site/core.js`

- [x] 2.1 Add `renameSubject(document, subjectId, title)` that trims the title,
  rejects a non-string, blank, or longer-than-100-character title, an unknown id
  and an unchanged title by returning the same document reference, and otherwise
  replaces only the matching subject's `title` while preserving its `id`,
  `items`, every `parentId`, order and priority. Verify with `node --check
  site/core.js`.
- [x] 2.2 Add deterministic `tests/core.test.mjs` cases: a valid rename changes
  only the title and keeps the subject and every item field identical; blank,
  whitespace-only, too-long, unknown-id and unchanged-name inputs all return the
  same reference and leave the input untouched. Verify with `npm test`.
- [x] 2.3 Add deterministic `tests/core.test.mjs` cases proving a renamed
  document round-trips through `parseDocument` with `version` 1, the five item
  keys, unchanged `parentId`s and no migration, and that the existing task
  functions (`visibleItems`, `reorderWithinPriority`, `planRemoval`,
  `nextActionSuggestion`) still behave identically on a navigated/renamed
  document. Verify with `npm test`.

## 3. Client routing and view switching in `site/app.js`

- [x] 3.1 Add `route = parseRoute(location.hash)`, a `hashchange` listener and a
  `navigate(hash)` helper that sets `location.hash` and lets `render()` run; on
  load and on every render resolve the target with `findSubject`. Verify with
  `node --check site/app.js`.
- [x] 3.2 Confirm opening a valid detail route, pressing browser Back/Forward and
  reloading a valid detail route all restore the matching view, and that
  `navigate`/`hashchange` never call `persist()`. Verify by comparing the
  localStorage value and the exported JSON before and after opening and closing
  a detail view with no business action.
- [x] 3.3 Render an accessible fallback panel (French message and a return
  control) when `parseRoute` returns `view: "invalid"` or the target subject is
  missing, without creating or modifying any subject. Verify by opening a
  malformed route, importing/deleting the open subject and using another tab to
  change the stored document.

## 4. Detail rendering that reuses the task area

- [x] 4.1 Factor `renderTaskArea(subject)` (the task form, the `visibleItems`
  list and the empty message) out of `renderSubject` and call it from the
  overview card, with no observable change to the overview. Verify with
  `node --check site/app.js` and by comparing the overview before and after the
  refactor.
- [x] 4.2 Render the detail view into `#subjects` as a `<section class="subject
  detail" data-subject="<id>">` containing the subject title heading, its
  subject-local unfinished-step count, « Retour à la vue d'ensemble »,
  « Renommer le projet » and the shared task area, rendering no other subject.
  Verify by opening a subject and confirming only its title, counter and steps
  appear.
- [x] 4.3 Add the « Ouvrir le projet » control to the overview card header with a
  French accessible name naming the subject, wiring it to `navigate` and
  confirming it starts no drag, edit, removal or form submission. Verify by
  keyboard, mouse and touch.
- [x] 4.4 Confirm every task operation in the detail view — add, edit, complete,
  collapse/expand, filter, reorder within the allowed subject/parent/priority
  group, remove and undo removal — produces the same document as the overview,
  that hidden substeps expose no handle or drop target, and that an invalid move
  changes nothing. Verify by running each operation in both views and diffing the
  exported JSON.

## 5. Rename control in `site/app.js`

- [x] 5.1 Render « Renommer le projet » opening an inline form prefilled with the
  current name, with « Enregistrer », « Annuler » and a `role="alert"` error node,
  reusing the rename validation rules and focusing the input. Verify with
  `node --check site/app.js` and by keyboard.
- [x] 5.2 On save, call `renameSubject`, persist exactly once only when the
  document reference changes, update the detail header and the overview card
  immediately, and place focus on a deterministic control afterwards. Verify by
  renaming and confirming the detail title, the overview card and the exported
  JSON all show the new name.
- [x] 5.3 Confirm that cancelling, submitting a blank or too-long name, or saving
  the unchanged name writes nothing and leaves the document, localStorage and the
  export strictly unchanged, with the validation message announced accessibly.
  Verify by attempting each rejected path and diffing the exported JSON.

## 6. Detail styles and accessibility

- [x] 6.1 Add the `.detail` presentation (spacious spacing), visible focus
  states, and ≥ 44 × 44 px touch targets for the new controls, keeping any
  animation inside a `prefers-reduced-motion: no-preference` guard and titles as
  text nodes. Verify by inspecting the computed styles.
- [x] 6.2 Verify at a narrow touch viewport, with `prefers-reduced-motion`
  enabled and using the keyboard only (Tab, Enter, Space), that opening,
  returning and renaming are operable, focus stays coherent and no non-essential
  animation plays.

## 7. Product documentation

- [x] 7.1 Update `docs/product/guide-utilisation.md` with a section describing
  the detail view: the « Ouvrir le projet » control, the dedicated single-project
  presentation, the reused task controls, the return/Back/Forward/reload
  behavior, the malformed/missing fallback, the presentation-only navigation and
  the « Renommer le projet » rules. Verify the text matches the shipped UI.
- [x] 7.2 Update `docs/product/mvp.md` with a new functional requirement and a
  matching acceptance test for the detail view and the targeted subject rename,
  noting the pending counter, suggestion, tracking and export stay coherent, and
  update the manual checklist if it references the overview as the only view.
  Verify the text matches the shipped behavior.
- [x] 7.3 Confirm no protected path (`AGENTS.md`, `.github/`, `backlog/`,
  `docs/factory/`, `opencode.json`, `openspec/config.yaml`) changed during
  implementation. Verify with `git status`.

## 8. Integration verification

- [x] 8.1 Run `npm run check` and report the exact command and its output.
- [x] 8.2 Run `openspec validate ts-016 --strict --no-interactive` and report
  the exact command and its output.
- [x] 8.3 Confirm the deltas under `openspec/changes/ts-016/specs/` contain only
  the expected `## ADDED Requirements` for `subject-detail-view` and
  `subject-renaming`, that no canonical spec under `openspec/specs/` was edited
  during planning, and that no `## Purpose` was added to an existing capability.
- [x] 8.4 Confirm the detail route survives reload and the rename survives an
  export followed by an import, that no browser-storage key beyond the existing
  document and resume keys is created, and that an absent/removed subject leads
  to the fallback without mutation. Verify with the export button, the browser
  storage inspector and `git status`.

## Post-sync review

- After the OpenCode OPSX sync, diff `openspec/specs/subject-detail-view/spec.md`
  and `openspec/specs/subject-renaming/spec.md` against their deltas and confirm
  the `## Purpose`, requirements and scenarios were copied without loss,
  duplication or rewording, and that the strict description-length check passes.
- Confirm that `action-editing/spec.md`, `action-ordering/spec.md`,
  `action-removal/spec.md`, `next-action-suggestion/spec.md`,
  `resume-tracking/spec.md`, `substep-collapse/spec.md` and
  `substep-ordering/spec.md` are byte-identical to their prior canonical
  revisions, since this change only adds two new capabilities.
- Verify the OPSX content-scope guard, the OpenSpec archive step and the
  independent PR CI `check`. A reviewer must approve the semantic diff before
  merge.
- Verify the GitHub Pages deployment and manually test opening, returning and
  renaming with a finger on a smartphone and at the keyboard, and confirm no new
  browser-storage key appears.
- These assertions cannot be ticked by apply before sync has run.

## Workflow follow-up

- Do not archive during implementation; sync and archive only through the
  project's reviewed process after every tracked task is checked and strict
  validation passes.
- Confirm no protected path changed and that independent CI passes before merge.
- This plan authorizes no paid model run, no apply, no merge and no archive.
