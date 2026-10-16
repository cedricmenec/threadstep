# Spec Delta

## MODIFIED Requirements

### Requirement: Drag handle on top-level actions

Every top-level action SHALL render a visible French drag handle with an
accessible name naming the action and its priority, used to rank it among the
top-level actions of one priority in its subject. The handle MUST be at least
44 × 44 px and MUST begin a pointer drag without triggering editing, removal,
tracking or completion. A one-level substep MUST NOT render a top-level handle;
substep ordering is owned by its own capability.

#### Scenario: Top-level action shows a handle

- **WHEN** a subject displays a top-level action
- **THEN** that action shows a visible drag handle with an accessible French name

#### Scenario: Substeps have no handle

- **WHEN** a subject displays a one-level substep
- **THEN** no top-level drag handle is rendered on that substep

#### Scenario: Handle name includes action and priority

- **WHEN** a handle is rendered for an action
- **THEN** its accessible name contains the action title and its priority

#### Scenario: Handle does not trigger other controls

- **GIVEN** a top-level action is displayed
- **WHEN** the user activates « Modifier », « Retirer », « Garder le fil » or the
  completion checkbox
- **THEN** no drag starts and the action is not moved

### Requirement: Parent carries its substeps

Moving a top-level action SHALL keep its substeps attached. Their `parentId`,
ids, titles, priorities, completion flags and mutual order MUST be unchanged by a
top-level reorder, and a top-level reorder MUST NOT move, reorder or re-parent
any substep.

#### Scenario: Parent move keeps its children

- **GIVEN** a top-level action has substeps
- **WHEN** the parent is reordered
- **THEN** every substep stays attached with unchanged `parentId`, data and order

#### Scenario: Substeps are not reorder targets

- **GIVEN** a top-level action has substeps
- **WHEN** a top-level action is dragged or moved with the move controls
- **THEN** no substep becomes a top-level reorder target and every substep stays
  attached with unchanged data and order