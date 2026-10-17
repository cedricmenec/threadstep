# Spec Delta

## ADDED Requirements

### Requirement: Compact row presentation

Rows SHALL use a tighter vertical rhythm than before in both the overview and the
detail view while preserving the hierarchy cues, multiline notes with their line
breaks, and touch targets of at least 44 × 44 px; long titles and narrow
viewports MUST NOT overlap or overflow horizontally.

#### Scenario: Rows are denser

- **WHEN** a subject with several tasks and substeps is rendered
- **THEN** its rows use less vertical space than before the change

#### Scenario: Notes are preserved

- **GIVEN** a task carries a multiline note
- **WHEN** its row is rendered compactly
- **THEN** the note is shown as plain text with its line breaks preserved

#### Scenario: Hierarchy cues are preserved

- **WHEN** a top-level task and its direct substeps are rendered compactly
- **THEN** indentation, the nesting guide and the typographic scale still distinguish them

#### Scenario: Long titles do not overlap

- **WHEN** a task has a long title
- **THEN** the row wraps without overlapping another control or the menu button

#### Scenario: Touch targets are preserved

- **WHEN** a control is rendered in a compact row
- **THEN** its touch target stays at least 44 × 44 px

## MODIFIED Requirements

### Requirement: Controls, focus and touch targets preserved

The completion, priority, drag handle, disclosure and per-item actions menu
controls SHALL remain directly visible and operable in both views, and the edit,
add, reorder and remove commands SHALL remain findable and operable through the
per-item actions menu, with a visible focus state and touch targets of at least
44 × 44 px. The visual change MUST NOT remove a control, change its accessible
name, or make a hierarchy cue start a drag, an edit or a completion toggle.

#### Scenario: Controls stay findable

- **WHEN** the hierarchy presentation is applied
- **THEN** every completion, priority, handle, disclosure and menu control is directly present, and every edit, add, reorder and remove command is reachable through the item menu

#### Scenario: Visible focus

- **WHEN** a control receives keyboard focus
- **THEN** a visible focus indicator is shown

#### Scenario: Touch target size

- **WHEN** a control is rendered on a touch viewport
- **THEN** its touch target is at least 44 × 44 px

#### Scenario: Hierarchy cues are inert

- **WHEN** the user activates a hierarchy cue such as the guide or the indentation area
- **THEN** no drag starts, no editor opens and no completion or priority changes
