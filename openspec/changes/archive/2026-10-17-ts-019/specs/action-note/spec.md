# Spec Delta

## Purpose

Lets a top-level action or one-level substep carry an optional, bounded,
plain-text note that is entered alongside its title, displayed without
interpreting user content, and preserved across the existing task operations and
the JSON export/import.

## ADDED Requirements

### Requirement: Optional bounded note field

An action or one-level substep MAY carry an optional `note`: a Unicode string of
at most 2 000 JavaScript characters, for top-level tasks and substeps alike. An
item without `note` MUST stay valid and MUST be treated as having an empty note
for display without rewriting stored data. The document MUST keep the V1 shape:
no new version, storage key, migration or external service, and `newItem` omits
the field until a note is entered.

#### Scenario: Legacy document without note remains valid

- **WHEN** an imported or stored V1 document has items without `note`
- **THEN** it is accepted, loaded and rendered as before

#### Scenario: Field omitted until a note is entered

- **WHEN** a new task or substep is created without a note
- **THEN** its item object has no `note` field

#### Scenario: Missing note is empty for display without rewriting

- **WHEN** an item without `note` is displayed
- **THEN** no note is shown and the stored document and its export are unchanged

#### Scenario: Note is bounded and keeps the V1 shape

- **WHEN** a note is stored
- **THEN** it is a Unicode string of at most 2 000 characters and the document
  version and storage key are unchanged

### Requirement: Multiline note entry in the inline editor

The inline editor SHALL offer a labelled multiline « Note (facultative) »
control prefilled with the current note or empty, limited to 2 000 characters.
« Enregistrer » validates title, priority and note together: a note longer than
2 000 characters shows an accessible error and saves nothing, a blank note
removes the `note` field, and a non-blank note is stored with line breaks
preserved. `id`, `done`, `parentId`, membership and order MUST be preserved.

#### Scenario: Editor prefills the existing note

- **WHEN** the user opens « Modifier » for an item that has a note
- **THEN** the multiline « Note (facultative) » control contains the current note

#### Scenario: Empty control when there is no note

- **WHEN** the user opens « Modifier » for an item without a note
- **THEN** the note control is empty

#### Scenario: Too-long note rejected

- **WHEN** the entered note exceeds 2 000 characters and the user saves
- **THEN** an accessible error is shown, the item is not modified and nothing is
  written

#### Scenario: Blank note removes the field

- **WHEN** the user clears the note, or enters only whitespace, and saves
- **THEN** the item has no `note` field and that removal is persisted

#### Scenario: Line breaks preserved

- **WHEN** a note containing line breaks is saved
- **THEN** the stored note keeps those line breaks

#### Scenario: Cancel or identical save writes nothing

- **WHEN** the user cancels, or saves without changing title, priority or note
- **THEN** the document, localStorage and the export are unchanged

#### Scenario: Other fields preserved

- **WHEN** a note is added, changed or removed and saved
- **THEN** `id`, `done`, `parentId`, subject membership and order are unchanged

### Requirement: Plain-text note display with preserved line breaks

A non-empty note SHALL appear in the task body, distinct from the title and its
substeps, as a plain text node with its line breaks preserved (`white-space:
pre-wrap` or equivalent). User content MUST NOT be interpreted as HTML, Markdown
or active links and MUST NOT be injected with `innerHTML`. The behaviour MUST be
identical in the overview and in the detail view.

#### Scenario: Note shown in the task body

- **WHEN** an item with a non-empty note is displayed
- **THEN** the note appears in the task body distinct from the title and substeps

#### Scenario: Line breaks rendered as line breaks

- **WHEN** a note contains line breaks
- **THEN** they are displayed as line breaks in plain text

#### Scenario: Markup shown literally

- **WHEN** a note contains markup such as `<img src=x onerror=alert(1)>`
- **THEN** it is displayed literally and creates no element

#### Scenario: Same note in both views

- **WHEN** the same item with a note is shown in the overview and the detail view
- **THEN** both views show the same note as plain text

### Requirement: Note preserved across task operations

Every existing task operation — completion, priority change, reordering, substep
collapse and removal undo — MUST preserve an item's `note` exactly. A note MUST
NOT create a new hierarchy level, status, counter or business rule, and a missing
note MUST NOT appear after an operation.

#### Scenario: Completion and priority keep the note

- **WHEN** an item with a note is completed or its priority changes
- **THEN** its note is unchanged

#### Scenario: Reorder and collapse keep the note

- **WHEN** an item with a note is reordered, or its substeps are collapsed
- **THEN** its note is unchanged and no new hierarchy or status appears

#### Scenario: Removal and undo restore the note

- **WHEN** an item with a note is removed and the removal is undone
- **THEN** the restored item has the same note

### Requirement: Export and import compatibility for notes

JSON export MUST include a non-empty note. Import MUST validate `note` when
present: a non-string value or a value longer than 2 000 characters MUST be
rejected atomically with a message and MUST NOT overwrite local data, while every
valid existing V1 document without `note` MUST stay importable. Export followed
by import MUST preserve notes and their line breaks.

#### Scenario: Export includes the note

- **WHEN** a document with notes is exported
- **THEN** each non-empty note is present in the JSON

#### Scenario: Historic import without note stays valid

- **WHEN** a valid V1 document with no `note` is imported
- **THEN** it is accepted and local data is replaced only after confirmation

#### Scenario: Invalid note rejected atomically

- **WHEN** an imported item has a non-string `note` or one longer than 2 000
  characters
- **THEN** the import fails with a message and no local data, field or structure
  is overwritten

#### Scenario: Round-trip preserves notes

- **WHEN** a document with multiline notes is exported and re-imported
- **THEN** the notes and their line breaks are preserved
