# Spec Delta

## MODIFIED Requirements

### Requirement: No re-parenting or level change

Reordering a substep MUST NOT change its `parentId`, MUST NOT move it to another
parent or subject, MUST NOT change its priority, and MUST NOT turn it into a
top-level action. A top-level action MUST NOT become a substep. The only
sanctioned level change is the explicit « Promouvoir en tâche principale »
operation owned by the `substep-promotion` capability; a reorder never performs
it.

#### Scenario: Parent stays the same

- **GIVEN** a substep belongs to parent P
- **WHEN** the substep is reordered
- **THEN** its `parentId` is still P and no other item's `parentId` changes

#### Scenario: Level stays the same

- **GIVEN** a top-level action and a substep
- **WHEN** any reorder is attempted between them
- **THEN** neither changes level and no item becomes a substep or a top-level
  action

#### Scenario: Priority is never changed by a move

- **WHEN** a substep is reordered
- **THEN** its priority and every other item's priority are unchanged

#### Scenario: Promotion is not a reorder

- **GIVEN** a one-level substep
- **WHEN** any supported reorder gesture or move control is used
- **THEN** it stays a substep with an unchanged `parentId`, and only the
  explicit « Promouvoir en tâche principale » command can change its level
