# Spec Delta

## Purpose

Shows, in each project header, the total number of top-level tasks a subject
contains, including completed ones and excluding substeps, as a French text label
that stays independent of the current filter, collapse state and overview preview.

## ADDED Requirements

### Requirement: Total top-level task count per subject

A subject's total SHALL be the number of its top-level tasks (`parentId: null`)
in `subject.items`, counting completed tasks and excluding direct substeps. The
total MUST be independent of the « Masquer les étapes terminées » filter, the
substep collapse state and the overview preview limit, and MUST be recomputed
from the complete item list on each render.

#### Scenario: Zero, one or many top-level tasks

- **WHEN** a subject has 0, 1 and 3 top-level tasks
- **THEN** its total is 0, 1 and 3 respectively

#### Scenario: Substeps are excluded

- **WHEN** a top-level task has several direct substeps
- **THEN** the substeps do not change the total and the parent counts once

#### Scenario: Completed tasks are included

- **WHEN** a top-level task is completed
- **THEN** it is still counted in the total

#### Scenario: Independent of the completion filter

- **WHEN** « Masquer les étapes terminées » is activated or deactivated
- **THEN** the total is unchanged

#### Scenario: Independent of the substep collapse

- **WHEN** a parent's substeps are collapsed or expanded
- **THEN** the total is unchanged

#### Scenario: Independent of the preview limit

- **WHEN** the overview preview shows at most five top-level tasks
- **THEN** the total still reflects every top-level task of the subject

### Requirement: Total label with French agreement

The overview project card header SHALL display the total as a French text label:
« 0 tâche au total », « 1 tâche au total » or « N tâches au total » for N > 1.
The label MUST be rendered as a text node, not as HTML, and MUST be perceptible
without relying on colour alone.

#### Scenario: Zero takes the singular

- **WHEN** a subject has no top-level task
- **THEN** the header shows « 0 tâche au total »

#### Scenario: One takes the singular

- **WHEN** a subject has exactly one top-level task
- **THEN** the header shows « 1 tâche au total »

#### Scenario: More than one takes the plural

- **WHEN** a subject has N > 1 top-level tasks
- **THEN** the header shows « N tâches au total »

#### Scenario: Markup shown literally

- **WHEN** a task title contains markup such as `<img src=x onerror=alert(1)>`
- **THEN** the header label is plain text and creates no element

### Requirement: Pending counter preserved

The existing « N étape(s) en attente » counter SHALL keep its current computation
(every unfinished item, substeps included) and wording. The total SHALL be shown
as a separate label and MUST NOT replace, rename or change the pending counter.

#### Scenario: Both counts are shown

- **WHEN** a project card header is rendered
- **THEN** it shows the pending counter and the total as two distinct labels

#### Scenario: Pending counts substeps, total does not

- **WHEN** a subject has unfinished substeps under a top-level task
- **THEN** the pending counter includes them and the total does not

#### Scenario: Completion affects the pending counter only

- **WHEN** a top-level task is completed
- **THEN** the pending counter decreases and the total is unchanged

### Requirement: Total follows document changes

Adding, removing, undoing a removal, importing and reordering SHALL update or
preserve the total exactly, from the in-memory document. No new field, storage
key, migration or network call SHALL be introduced.

#### Scenario: Adding a top-level task

- **WHEN** a top-level task is added to a subject
- **THEN** the total increases by one

#### Scenario: Adding a substep

- **WHEN** a substep is added to a top-level task
- **THEN** the total is unchanged

#### Scenario: Removing a top-level task

- **WHEN** a top-level task is removed
- **THEN** the total decreases by one

#### Scenario: Undoing a removal

- **WHEN** a removal is undone within the undo window
- **THEN** the total returns to its previous value

#### Scenario: Importing a document

- **WHEN** a valid document is imported
- **THEN** each subject's total matches the imported top-level tasks

#### Scenario: Reordering tasks

- **WHEN** top-level tasks are reordered within their priority group
- **THEN** the total is unchanged

### Requirement: Presentation-only and mobile-readable total

Computing and displaying the total SHALL be presentation-only: it MUST NOT mutate
the document, write localStorage, change the JSON export, or add a field, id,
storage key or persistent preference. The label SHALL remain legible and wrap in
narrow mobile headers.

#### Scenario: No write without a business action

- **WHEN** the overview or the detail view renders the total
- **THEN** the document, localStorage and the JSON export are strictly unchanged

#### Scenario: Legible on a narrow viewport

- **WHEN** the header is shown on a narrow mobile viewport
- **THEN** the total label stays visible and wraps without being cut off

