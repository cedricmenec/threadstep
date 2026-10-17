# Spec Delta

## Purpose

Lets the user immediately distinguish a top-level task from its direct substeps
in both the overview and the detail view, using durable structural
presentation cues rather than colour alone, without changing any data or
business rule.

## ADDED Requirements

### Requirement: Non-colour-exclusive parent/substep distinction

Every top-level task and its direct substeps SHALL be distinguishable by at
least two cues that are not solely chromatic, such as indentation/spacing, a
structural nesting guide and typographic scale. The distinction MUST remain
perceivable when colour and the priority-badge nuance are ignored; colour MAY be
an additional cue but MUST NOT be the only one.

#### Scenario: At least two cues without colour

- **WHEN** a top-level task with direct substeps is rendered
- **THEN** the hierarchy is conveyed by at least two cues that do not rely on colour alone

#### Scenario: Priority nuance is not required

- **WHEN** the priority badges are visually disregarded
- **THEN** a top-level task is still distinguishable from its direct substeps

#### Scenario: Independent of the completion state

- **WHEN** a parent and its direct substeps are all completed
- **THEN** the parent/child hierarchy is still readable from the same cues

### Requirement: Identical hierarchy in the overview and the detail view

Both the overview and the detail view SHALL present top-level tasks and direct
substeps with the same hierarchy cues, including the parent's own commands and
its child list. Switching views MUST NOT change which element is a parent, which
elements are its direct substeps, or the cue pattern used to show it.

#### Scenario: Same cues in both views

- **WHEN** the same subject is displayed in the overview and in the detail view
- **THEN** a top-level task and its direct substeps show the same hierarchy cues

#### Scenario: Applied to completed tasks

- **WHEN** a top-level task and its direct substeps are completed
- **THEN** the hierarchy cues are shown in both views

#### Scenario: Applied to a filtered list

- **WHEN** « Masquer les étapes terminées » removes some entries
- **THEN** the remaining top-level tasks and direct substeps keep the hierarchy cues in both views

#### Scenario: Applied to a collapsed parent

- **WHEN** a parent's substeps are collapsed
- **THEN** the parent keeps its top-level identity and its disclosure control in both views

### Requirement: Semantic parent/child structure preserved

Top-level tasks SHALL remain `li` elements of a task list and direct substeps
SHALL remain inside a `ul` rendered as a child of the correct parent `li`.
Reading order, accessible names and the parent/substep association MUST be
preserved, and no element is promoted, hidden or re-parented for presentation.

#### Scenario: Parent stays a list item

- **WHEN** a top-level task is rendered
- **THEN** it is an `li` in the subject's task list

#### Scenario: Substeps stay children of the right parent

- **WHEN** a top-level task has direct substeps
- **THEN** their `ul` is a child of that parent's `li` and of no other parent

#### Scenario: Reading order and accessible names unchanged

- **WHEN** the hierarchy presentation is applied
- **THEN** the reading order and the accessible names of the parent and its substeps are unchanged

### Requirement: Controls, focus and touch targets preserved

Edit, add, reorder, collapse and undo controls SHALL remain findable and
operable in both views, with a visible focus state and touch targets of at
least 44 × 44 px. The visual change MUST NOT remove, hide or reorder a control,
change its accessible name, or make a hierarchy cue start a drag, an edit or a
completion toggle.

#### Scenario: Controls stay findable

- **WHEN** the hierarchy presentation is applied
- **THEN** every add, edit, reorder, collapse and remove/undo control is still present and reachable

#### Scenario: Visible focus

- **WHEN** a control receives keyboard focus
- **THEN** a visible focus indicator is shown

#### Scenario: Touch target size

- **WHEN** a control is rendered on a touch viewport
- **THEN** its touch target is at least 44 × 44 px

#### Scenario: Hierarchy cues are inert

- **WHEN** the user activates a hierarchy cue such as the guide or the indentation area
- **THEN** no drag starts, no editor opens and no completion or priority changes

### Requirement: Responsive legibility without horizontal overflow

On usual mobile widths the hierarchy cues SHALL remain visible and the content
MUST NOT overflow horizontally: substep indentation, the nesting guide and the
typography SHALL adapt responsively so every control stays reachable and no
text or badge is clipped.

#### Scenario: Narrow viewport keeps the hierarchy

- **WHEN** the views are shown at a usual mobile width
- **THEN** a top-level task and its direct substeps remain visually distinguishable

#### Scenario: No horizontal overflow

- **WHEN** the views are shown at a usual mobile width
- **THEN** no horizontal scrollbar appears and no content is clipped

#### Scenario: Controls remain reachable

- **WHEN** the hierarchy cues adapt on a narrow viewport
- **THEN** every control remains reachable and usable

### Requirement: Priority, completion, motion and contrast preserved

The semantic priority and completion colours SHALL keep their existing meaning
and remain perceivable, focus indicators and theme contrast SHALL be preserved,
and any transition SHALL respect `prefers-reduced-motion`; no non-essential
animation is required for the hierarchy to be understood.

#### Scenario: Priority colours unchanged

- **WHEN** tasks of each priority are rendered
- **THEN** the existing `priority-<value>` semantics and colours are preserved

#### Scenario: Completed state preserved

- **WHEN** a task is completed
- **THEN** its existing completed presentation is preserved

#### Scenario: Reduced motion honored

- **WHEN** `prefers-reduced-motion` is enabled
- **THEN** no non-essential animation is required or played for the hierarchy

#### Scenario: Contrast preserved

- **WHEN** the hierarchy cues are shown
- **THEN** the existing theme text and control contrast is not reduced

### Requirement: Presentation-only with no data or rule change

Applying the hierarchy SHALL be presentation-only: it MUST NOT change document
data, item order, priorities, completion flags, counters, routes, localStorage
or the JSON export, MUST NOT add a field, id, storage key or dependency, and
MUST render user titles as text nodes, never as HTML.

#### Scenario: No write without a business action

- **WHEN** the views are rendered with the hierarchy presentation
- **THEN** the document, localStorage and the JSON export are strictly unchanged

#### Scenario: Order, priorities and counters unchanged

- **WHEN** the hierarchy presentation is applied
- **THEN** the item order, priorities, completion flags and counters are unchanged

#### Scenario: No new field, key or dependency

- **WHEN** the views are rendered repeatedly
- **THEN** no new field, id, storage key or dependency is created

#### Scenario: Markup shown literally

- **WHEN** a title contains markup such as `<img src=x onerror=alert(1)>`
- **THEN** it is displayed literally and creates no element
