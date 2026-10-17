# Tasks

## 1. Domain: optional note field and validation in `site/core.js`

- [ ] 1.1 Add `NOTE_MAX_LENGTH = 2000` and extend `updateItem(document,
  subjectId, itemId, patch)` so an optional `patch.note` is applied atomically
  with `title` and `priority`: when the `note` property is absent the current
  note is preserved; when present it must be a string of at most
  `NOTE_MAX_LENGTH` characters or the original document reference is returned; a
  note that trims to empty removes the `note` key from the rebuilt item; a
  non-blank note is stored verbatim with its line breaks; the rebuilt item
  includes `note` only when it is non-empty; and the no-op comparison includes
  the normalized note so an identical edit returns the same reference; verify
  with `node --check site/core.js`.
- [ ] 1.2 Extend `parseDocument` to validate an item's `note` only when the
  property is present: require `typeof note === "string"` and
  `note.length <= NOTE_MAX_LENGTH`, otherwise throw the existing « Étape invalide
  dans le fichier. » error, leaving a document without `note` and `newItem`
  output unchanged; verify with `node --check site/core.js`.
- [ ] 1.3 Add deterministic cases to `tests/core.test.mjs` for the optional
  field: an old V1 document and a `newItem` without `note` are valid, the rebuilt
  item keeps the exact key set `["done","id","parentId","priority","title"]` when
  no note is entered, a note of exactly 2 000 characters is accepted and a
  2 001-character or non-string value is refused without mutation, a blank or
  whitespace-only note removes the key, a non-blank note (accents, line breaks
  and an `<img src=x onerror=alert(1)>`-like string) is stored verbatim, an
  unchanged `title`/`priority`/`note` returns the same reference, and no input
  array or item is mutated; verify with `npm test`.
- [ ] 1.4 Add deterministic cases to `tests/core.test.mjs` for the import and
  preservation contract: a historic export without `note` round-trips through
  `parseDocument`, a multiline note survives `parseDocument(JSON.stringify(doc))`
  with its line breaks, an import whose `note` is `null`, a number or longer than
  2 000 characters is rejected atomically (the exception throws and an existing
  local document is unchanged), and the note is preserved through
  `setItemPriority`, `reorderWithinPriority`/`moveWithinPriority`,
  `planRemoval`/`restoreRemoval` and a completion-flag change; verify with
  `npm test`.

## 2. Inline editor: multiline note control in `site/app.js`

- [ ] 2.1 In `renderEditor`, add a `<textarea class="task-edit-note">` with
  `maxLength = 2000`, a few `rows`, an associated visible label « Note
  (facultative) » and an accessible name naming the edited item, prefilled with
  `typeof item.note === "string" ? item.note : ""`, placed beside the existing
  title and priority controls without changing the existing « Enregistrer »,
  « Annuler » or error elements; verify with `node --check site/app.js`.
- [ ] 2.2 In the editor submit handler, validate the note length before saving:
  a note longer than 2 000 characters fills the existing
  `<p class="edit-error" role="alert">`, focuses the note control and returns
  without calling `updateItem` or `persist`; otherwise pass
  `{ title, priority, note }` to `updateItem` so a blank note removes the field
  and an unchanged edit skips `persist`; verify with `node --check site/app.js`.
- [ ] 2.3 Create `tests/action-note.test.mjs` reading `site/app.js` as text and
  asserting the `task-edit-note` textarea, the « Note (facultative) » label, the
  `maxLength = 2000`, the `{ title, priority, note }` patch and the reuse of the
  `edit-error` alert; verify with `npm test`.

## 3. Display: plain-text note in the task body

- [ ] 3.1 In `site/app.js`, add a `renderNote(item)` helper building a
  `<p class="task-note">` with the existing `el()` text-node helper and call it
  from `renderItem` between `renderRow` and `renderActions`, only when
  `typeof item.note === "string" && item.note.trim().length > 0`, so the note
  appears in both the overview and the detail view and no `innerHTML` is used;
  verify with `node --check site/app.js`.
- [ ] 3.2 Add a `.task-note` rule in `site/styles.css` with
  `white-space: pre-wrap` and a wrap rule for narrow viewports, no colour-only
  signalling and no animation; verify at a mobile width with no new dependency.
- [ ] 3.3 Extend `tests/action-note.test.mjs` with static assertions that
  `renderNote` is called in `renderItem`, that `.task-note` uses
  `white-space:pre-wrap`, and that neither `renderNote` nor the note path uses
  `innerHTML`; verify with `npm test`.
- [ ] 3.4 Extend `tests/action-note.test.mjs` to assert the editor still routes
  through `updateItem` and keeps the unchanged-reference short circuit
  (`if (next === documentState) { render(); return; }`), so cancelling, an invalid
  note or an identical re-save writes nothing, and that the note is carried in
  the update patch; verify with `npm test`.

## 4. Product documentation

- [ ] 4.1 Update `docs/product/guide-utilisation.md` with a short section
  describing the optional « Note (facultative) » field, its 2 000-character
  limit, the preserved line breaks, the plain-text (non-Markdown, non-HTML)
  rendering in both views, the blank-note removal and the export/import
  compatibility; verify the text matches the shipped behavior and that
  `npm run check` still passes.
- [ ] 4.2 Update `docs/product/mvp.md` to add FR-22 and its matching acceptance
  test (optional bounded note, plain-text display with line breaks preserved,
  preserved across the existing operations, atomic rejection of an invalid note,
  historical V1 documents without `note` still importable, no new version, key or
  migration); verify the text matches the shipped behavior and that
  `npm run check` still passes.

## 5. Integration verification

- [ ] 5.1 Run `npm run check` and report the exact command and its output.
- [ ] 5.2 Run `openspec validate ts-019 --strict --no-interactive` and report the
  exact command and its output.

## Post-sync review

- After the OpenCode OPSX sync, diff the new canonical
  `openspec/specs/action-note/spec.md` and the canonical
  `openspec/specs/action-editing/spec.md` against their deltas and confirm the
  `## Purpose` (new capability only), requirements and scenarios were copied
  without loss, duplication or rewording, that the two MODIFIED `action-editing`
  requirements kept their exact headers, and that the strict
  description-length check passes.
- Confirm every other canonical spec under `openspec/specs/` is byte-identical to
  its prior revision, since this change adds one capability and modifies only
  `action-editing`.
- Verify the OPSX content-scope guard, the OpenSpec archive step and the
  independent PR CI `check`; a reviewer must approve the semantic diff before
  merge. These assertions cannot be ticked by apply before the sync has run.

## Manual acceptance

- On a real browser, create, modify and clear a note on both a top-level task and
  a substep; check the field, the preserved line breaks, the accessible error for
  an over-long note and touch legibility.
- In a browser, import an earlier backup without notes and a new export with
  multiline notes, and confirm the plain-text rendering is safe (an HTML-like
  note is shown literally) — without marking these checks as done on the sole
  basis of Node tests.
- Examine the independent PR and OpenSpec sync evidence before the final user
  acceptance. No claim recorded here counts as validation until it has actually
  been run.

## Workflow follow-up

- Do not archive during implementation; sync, semantically verify and archive
  only through the project's reviewed process after every tracked task is checked
  and strict validation passes.
- Requalify the risk (from `low`) and stop if any schema widening or migration is
  found, rather than ticking a box by assumption: the `low` rating rests on the
  optional, backwards-compatible `note` field.
- Confirm no protected path changed and that independent CI passes before merge.
- This plan authorizes no paid model run, no apply, no merge and no archive.
