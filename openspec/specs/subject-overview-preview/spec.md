# subject-overview-preview Specification

## Purpose

Keeps each overview project card compact by previewing only its first five
visible top-level tasks and giving a single accessible control to open the full
project detail, without changing stored data.

## Requirements

### Requirement: Overview top-level preview limit

Each overview project card SHALL render at most the first five visible top-level
tasks (`parentId: null`) in the existing order (priority, then manual order)
after the « Masquer les étapes terminées » filter is applied. A top-level task
and its direct substeps count as one entry; substeps MUST NOT consume a preview
slot. The limit applies independently to each card.

#### Scenario: Zero to six visible tasks

- **WHEN** a card has 0, 1, 5 and 6 visible top-level tasks
- **THEN** it renders 0, 1, 5 and 5 tasks respectively

#### Scenario: Filter is applied before the limit

- **WHEN** completed tasks are hidden
- **THEN** those tasks never consume a preview slot and are never used to fill the quota

#### Scenario: Substeps do not consume a slot

- **WHEN** a previewed task has many visible direct substeps, whether the parent
  is collapsed or expanded
- **THEN** it still counts as one preview entry and does not reduce the five
  top-level entries

#### Scenario: Projects are independent

- **WHEN** several cards each have more than five visible top-level tasks
- **THEN** each card limits its own entries without affecting the others

#### Scenario: Existing counters stay complete

- **WHEN** a preview is limited
- **THEN** the project and global counters remain based on the complete document

### Requirement: « Voir plus » opens the full detail

WHEN more than five visible top-level tasks remain for a project, the overview
SHALL show exactly one French « Voir plus » control whose accessible name
identifies the project. Activating it SHALL open the existing `#/sujet/<id>`
detail route of that project with the existing history, return and focus
behavior, where no five-task limit applies. WHEN five or fewer remain, no
« Voir plus » control is shown.

#### Scenario: Shown only beyond five

- **WHEN** a card has five or fewer visible top-level tasks
- **THEN** no « Voir plus » control is shown

#### Scenario: Opens the correct project

- **WHEN** « Voir plus » is activated on card A
- **THEN** the existing detail route of A is shown

#### Scenario: Detail is not limited

- **WHEN** the detail route is opened
- **THEN** every task allowed by the current filter is available, including those beyond the five previewed entries

#### Scenario: Exactly one control

- **WHEN** a card previews its entries
- **THEN** at most one « Voir plus » control is rendered for that card

### Requirement: Hidden preview entries are unreachable

Top-level tasks beyond the preview, and their direct substeps, MUST NOT be
present in the overview DOM. They MUST NOT receive focus and MUST NOT be sources
or targets of reordering in the overview.

#### Scenario: Absent from the overview DOM

- **WHEN** a task is beyond the preview
- **THEN** it and its substeps have no element in the overview

#### Scenario: Not keyboard reachable

- **WHEN** the user navigates the overview with the keyboard
- **THEN** no control of a task beyond the preview receives focus

#### Scenario: Not a drag source or target

- **WHEN** a drag starts or a drop point is resolved in the overview
- **THEN** only previewed tasks are offered as source or target

### Requirement: Presentation-only preview

Applying the preview limit, activating « Voir plus » and changing the filter,
completion or priorities SHALL recalculate the preview without modifying
`documentState`, ids, priorities, the JSON export or localStorage, and without
adding a field, storage key or persistent preference.

#### Scenario: No write without a business action

- **WHEN** the preview is rendered, recalculated or « Voir plus » is activated
- **THEN** the document, localStorage and the JSON export are strictly unchanged

#### Scenario: Recalculation follows current state

- **WHEN** a filter, a completion or a priority changes
- **THEN** the preview recalculates from the current document without mutating it

### Requirement: Accessible « Voir plus » control

The « Voir plus » control SHALL be operable by keyboard, mouse and touch, with a
visible focus state, a touch target of at least 44 × 44 px and an accessible name
naming the project. Its project title MUST be rendered as a text node, never as
HTML.

#### Scenario: Keyboard and touch operation

- **WHEN** the control is reached by Tab, Enter or Space, or tapped
- **THEN** the detail route opens without using another control

#### Scenario: Touch target and focus

- **WHEN** the control is displayed
- **THEN** it provides a visible focus indicator and at least a 44 × 44 px target

#### Scenario: Markup shown literally

- **WHEN** a project title contains markup such as `<img src=x onerror=alert(1)>`
- **THEN** the accessible name contains it as literal text and creates no element
