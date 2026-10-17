# Proposal

## Why

A next step often needs a few lines of context — a phone number, a link to
follow up, the reason a decision is pending — that does not belong in the short
title. Today the only editable fields are `title` and `priority`, so the user
either overstuffs the title or keeps that context outside ThreadStep. TS-019 adds
an **optional free-text note** to every task and substep, without turning
ThreadStep into a rich-text editor.

## What Changes

- Add an **optional** `note` field (Unicode string, at most 2 000 JavaScript
  characters) to the `item` shape of the V1 document, for top-level tasks **and**
  one-level substeps. An older object without `note` stays valid, and `newItem`
  omits the field until a note is entered. No destructive migration, no new
  document version, no new localStorage key, no external service.
- In the existing inline editor, add a multiline « Note (facultative) » control
  prefilled with the current value. « Enregistrer » validates title, priority and
  note together and changes only `title`, `priority` and `note`, preserving the
  `id`, `done`, `parentId` and order. A note longer than 2 000 characters shows an
  accessible error and saves nothing. A blank or whitespace-only note removes the
  `note` field. Cancelling or re-saving unchanged values writes nothing.
- Display a non-empty note in the task body, distinct from the title and its
  substeps, as a **plain text node** with line breaks preserved (`white-space:
  pre-wrap` or equivalent). Never use `innerHTML` and never interpret Markdown,
  HTML or active links from user content. Same behaviour in the overview and in
  the detail view.
- Preserve notes through completion, priority change, reordering, substep
  collapse and removal undo, and through JSON export and import. Import validates
  the presence, type and length of `note`, rejects an invalid note **atomically**
  without overwriting local data, and still accepts every valid existing V1
  document without a note.
- **BREAKING**: none. No document, storage key, JSON-shape-breaking, route or
  dependency change; historical exports remain importable.
- Update the canonical specs and the product documentation (user guide, MVP
  FR-22), with deterministic Node tests for the parser, the domain and the
  rendering rules.

## Capabilities

### New Capabilities

- `action-note`: an optional, bounded, plain-text note attached to any
  top-level action or one-level substep — document field and validation,
  multiline entry in the inline editor, safe line-break-preserving display,
  preservation across the existing task operations, and JSON export/import
  compatibility with atomic rejection of invalid notes.

### Modified Capabilities

- `action-editing`: the existing inline editor's prefill and save requirements
  change so the editor also prefills the optional note and saves `title`,
  `priority` and `note` together while preserving `id`, `done`, `parentId`,
  subject membership and order.

## Impact

- `site/core.js`: add `NOTE_MAX_LENGTH`, an optional-note validator/normalizer,
  extend `updateItem` to change `title`, `priority` and `note` immutably with a
  no-op fast path, and extend `parseDocument` to validate `note` type and length;
  `newItem` still omits `note`. No change to the existing operations' shape.
- `site/app.js`: add the labelled multiline « Note (facultative) » control to
  `renderEditor`, include its value in the `updateItem` patch and its validation
  in the accessible error path, and render a non-empty `item.note` as a plain
  text node in `renderRow` (shared by the overview and the detail view).
- `site/styles.css`: minimal styles for the note field and the note body
  (`white-space: pre-wrap`, wrapping) legible on mobile, without colour-only
  signalling.
- `tests/core.test.mjs`: deterministic cases for the optional field, the 2 000
  character limit, blank removal, immutability, no-op, the old-import-without-note
  compatibility, the multiline round-trip, atomic rejection of invalid notes and
  preservation across the existing operations.
- `tests/action-note.test.mjs` (new): static assertions over `site/app.js` and
  `site/styles.css` for the editor control, the plain-text `pre-wrap` rendering
  and the absence of `innerHTML`; these do not replace manual acceptance.
- `docs/product/guide-utilisation.md` and `docs/product/mvp.md`: describe the
  optional note field, its limit, its plain-text rendering and its
  import/export guarantees (FR-22, TS-019).
- Unchanged: document version, `threadstep.document.v1`,
  `threadstep.resume.v1`, routes, dependencies, network, workflows, `AGENTS.md`,
  `backlog/` and `docs/factory/`.

## Non-Goals / Out of Scope

- Markdown, rich text, attachments, network preview, collaborative comments,
  full-text search, note history or character-by-character autosave.
- Making `note` mandatory for historical imports, or any destructive migration,
  new version, new storage key or external service.
- New hierarchy levels, statuses, counters or business rules; a note is not a
  second title and is never editable outside the inline editor.
- Interpreting user note content as HTML, Markdown or active links.

## Unresolved Decisions / Uncertainties

- **Whitespace of a non-blank note.** Planned: store the entered text of a
  non-blank note verbatim (no trimming) so line breaks and exact content are
  preserved, while a blank or whitespace-only note removes the field. Whether to
  trim leading/trailing whitespace on save is a review detail with no data-safety
  impact.
- **An imported `note` that is `null`.** Planned: rejected as a non-textual type,
  since valid documents either omit `note` or carry a string. Whether `null`
  should instead be tolerated as an absence is a review detail.
- **Exact placement and markup of the displayed note.** Planned: a separate block
  after the task's title row, rendered as a text node with `pre-wrap`; the
  precise spacing is a presentation detail.
- **Requirement identity in `action-editing`.** Planned: the existing
  « Save changes title and priority only » requirement keeps its header and gains
  the optional note in its body, to avoid an untested requirement rename. The
  final wording is a review detail.
