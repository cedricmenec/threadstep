# Design

## Context

See `proposal.md` — Why, and `specs/action-note/spec.md` and
`specs/action-editing/spec.md` for the requirements. ThreadStep keeps all domain
logic in pure functions in `site/core.js`, covered by deterministic Node tests in
`tests/core.test.mjs`; the DOM wiring in `site/app.js` has no browser harness and
is checked by static text assertions over `site/app.js` / `site/styles.css` (see
`tests/overview-preview.test.mjs`, `tests/task-total.test.mjs`).

The two functions that define the data contract today are:

- `updateItem(document, subjectId, itemId, patch)` (`site/core.js:45-60`): the
  only edit path. It requires a string `title`, validates the trims and the
  300-character bound, validates `priority`, returns the same document reference
  for any invalid or unchanged patch, and rebuilds the item as
  `{ ...entry, title, priority }`.
- `parseDocument(source)` (`site/core.js:301-335`): the import validator. It
  throws on an invalid version, subject, item, priority, `done`, `parentId`
  shape or hierarchy, and returns the parsed document. `app.js` calls it before
  any replacement, so a throw leaves local data untouched.

The item shape today is
`{ id, title, priority, done, parentId }` and is exercised by tests that assert
that exact key set (for example `tests/core.test.mjs:73`, `:1161`). Every other
task operation already preserves unknown fields by spreading or reusing the item
reference: `setItemPriority` uses `{ ...entry, priority }`, reorder keeps item
references, `planRemoval`/`restoreRemoval` copy `{ ...entry }`.

## Goals / Non-Goals

**Goals:**

- One optional, bounded `note` field on any item, validated in the domain and in
  the import parser, with an immutable edit path that has a cheap no-op fast path.
- A multiline note control folded into the existing inline editor so title,
  priority and note are saved atomically through the existing `updateItem`.
- Safe, line-break-preserving plain-text rendering shared by the overview and the
  detail view.
- Compatibility with every existing V1 document and export, and atomic rejection
  of invalid notes on import.

**Non-Goals:**

- A DOM test harness, a framework, a new dependency, a new storage key, a
  document version or a migration.
- Rich text, Markdown, attachments, search, history or autosave.
- A second editing surface for notes outside the existing inline editor.

## Decisions

1. **Extend `updateItem` instead of adding a separate note setter.**
   - The editor saves title, priority and note in one submit, so a single call
     must apply them atomically. `patch.note` is optional: when the property is
     absent the current note is preserved; when present it must be a string of at
     most `NOTE_MAX_LENGTH` (2 000) characters, otherwise the patch is refused
     and the original document reference is returned.
   - Normalization: a `note` that trims to empty removes the field (the rebuilt
     item omits the `note` key); a non-blank note is stored verbatim, preserving
     line breaks and inner whitespace. The no-op check compares the normalized
     note with the current one, so re-saving identical values returns the same
     document and writes nothing.
   - `note` is omitted from the rebuilt object when it is removed, so items
     without a note keep the existing key set and the existing tests'
     `["done","id","parentId","priority","title"]` assertion stays true.
   - **Rationale:** one atomic edit path is simpler to test and cannot leave a
     half-saved item. Alternatives rejected: a separate `setItemNote` (the editor
     would then need two calls and could partially save), and requiring `note` in
     every patch (would break existing callers and tests and force callers with
     no note field to pass one).

2. **Validate the optional note in `parseDocument`, not by rejecting old files.**
   - When an item has a `note` property, require `typeof note === "string"` and
     `note.length <= 2000`; otherwise throw the existing
     « Étape invalide dans le fichier. » error. Absence of `note` stays valid.
   - **Rationale:** the import handler already parses fully before replacing the
     document, so throwing is already atomic; the only new rule is the note type
     and length. `null` is non-string and is rejected as a non-textual type, while
     a historic export that simply omits `note` is untouched. Alternatives
     rejected: tolerating `null` (ambiguous, and the app never writes it) and
     coercing values (would hide invalid files).

3. **`newItem` stays unchanged.**
   - New items are created without a note; the field appears only after the user
     saves a non-blank note. This matches the requirement that `newItem` may omit
     the field and keeps new-item objects byte-identical for existing tests.
   - **Rationale:** an optional field must not appear by default; a note is
     entered deliberately through the editor. Alternatives rejected: defaulting
     `note: ""` (adds a key everywhere and contradicts "removes the field").

4. **One shared render path for the note.**
   - `renderItem` appends a `renderNote(item)` block between `renderRow` and
     `renderActions`, only when `typeof item.note === "string" &&
     item.note.trim().length > 0`. The block is a `<p class="task-note">` built
     with the existing `el()` helper, so the note is set as `textContent`.
     `renderItem` is used by both the overview and the detail view, so the note
     is identical in both.
   - CSS `.task-note` uses `white-space: pre-wrap` (with `overflow-wrap:anywhere`)
     so line breaks are visible and long content wraps on mobile, without
     colour-only signalling.
   - **Rationale:** a plain text node plus `pre-wrap` is the smallest safe way to
     keep line breaks without interpreting content. Alternatives rejected:
     `innerHTML`/`<br>` conversion (unsafe and forbidden), a `<textarea readonly>`
     or `<pre>` (semantically an input, and `pre` does not wrap by default).

5. **The editor gets one labelled textarea and reuses the existing error path.**
   - `renderEditor` adds a `<textarea class="task-edit-note">` with an associated
     visible label « Note (facultative) », `rows` set for a few lines, and
     `maxLength = 2000`; its value is `typeof item.note === "string" ? item.note :
     ""`. The submit handler validates the note length first (defensive, since
     `maxLength` also bounds typing and pasting): a too-long note fills the
     existing `<p class="edit-error" role="alert">`, focuses the note control and
     returns without calling `updateItem` or `persist`. Otherwise the patch is
     `{ title, priority, note }`; the unchanged-reference branch already skips
     `persist`, giving the "identical save writes nothing" behaviour.
   - **Rationale:** reusing the editor, its form and its alert keeps a single
     accessible save/cancel surface and one validation path. Alternatives
     rejected: a separate note editor (a second editing surface, out of scope)
     and a browser `alert()` (not in-page, not the existing pattern).

6. **No write on load for a missing note.**
   - `load()`/`parseDocument` never add a `note`; the render path treats a
     missing note as empty. No `persist()` is called while rendering.
   - **Rationale:** opening an old document must not silently rewrite it, which
     the requirements and the product constraint both demand.

7. **Tests: pure behaviour in `core.test.mjs`, wiring asserted statically.**
   - `tests/core.test.mjs` gains deterministic cases for the optional field, the
     2 000-character boundary, blank removal, immutability and the no-op fast
     path, old-import compatibility, the multiline export/import round-trip,
     atomic rejection of a non-string or too-long note, and note preservation
     through `setItemPriority`, `reorderWithinPriority`/`moveWithinPriority`,
     `planRemoval`/`restoreRemoval` and a completion toggle.
   - A new `tests/action-note.test.mjs` reads `site/app.js` and
     `site/styles.css` as text and asserts the textarea, the label, the patch
     field, the `renderNote` block, `pre-wrap` and the absence of `innerHTML`.
   - **Rationale:** matches the existing no-browser test pattern. Static
     assertions complement, but never replace, the manual acceptance checks in
     `tasks.md`.

## Risks / Trade-offs

- **Historic import breaks if `note` becomes mandatory.** → `note` is validated
  only when present; absence stays valid, with dedicated tests for a document
  without `note` and for `newItem`.
- **Invalid import overwrites local data.** → `parseDocument` validates the whole
  document and throws before `app.js` assigns `documentState`; the atomicity test
  asserts the local document and storage are unchanged.
- **Note content executed as HTML.** → The note is only ever set through
  `textContent` in a `<p>`; no `innerHTML`, no Markdown. A test asserts an
  `<img src=x onerror=alert(1)>` note is shown literally, and a static test
  asserts no `innerHTML` near the note rendering.
- **Note lost by an existing operation.** → All operations already spread or
  reuse the item; dedicated tests assert the note survives completion, priority
  change, reorder, collapse and removal undo.
- **`updateItem` no-op detection regresses.** → The comparison includes the
  normalized note, and the existing invalid/no-op cases remain, so an identical
  save returns the same reference and writes nothing.
- **Whitespace interpretation of a non-blank note.** → Stored verbatim and
  displayed with `pre-wrap`; only fully blank notes delete the field. The exact
  trimming policy is a review detail recorded in `proposal.md`.
- **Requirement header « Save changes title and priority only » no longer matches
  its body.** → The header is kept verbatim to avoid an untested RENAMED
  operation; the body explicitly includes the optional `note`.
- **Static tests mistaken for acceptance.** → The `Manual acceptance` section of
  `tasks.md` records the remaining browser checks without checkboxes; no
  automated assertion is presented as user validation.

## Migration Plan

None. No schema version, storage key, route or destructive migration is added.
A document written before this change remains valid and is never rewritten on
load. Rollback removes the note control, the `renderNote` block, the note
handling in `updateItem`/`parseDocument` and the `NOTE_MAX_LENGTH` constant;
existing documents stay valid and a stored `note` is simply ignored, so no data
repair is required.

## Open Questions

None that change the specs, the approach or the task breakdown. The whitespace
policy for a non-blank note, the handling of an imported `null` note and the
exact note placement are recorded as uncertainties in `proposal.md` and are safe
to confirm during review.
