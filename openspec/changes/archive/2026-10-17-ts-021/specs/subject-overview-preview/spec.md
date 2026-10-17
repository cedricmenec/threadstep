# Spec Delta

## MODIFIED Requirements

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
