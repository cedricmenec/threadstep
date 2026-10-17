# Spec Delta

## MODIFIED Requirements

### Requirement: Handle and move controls on one-level substeps

Every one-level substep SHALL render a visible French drag handle on its row and
SHALL expose accessible « Monter » / « Descendre » commands through its per-item
actions menu. The handle MUST be at least 44 × 44 px and MUST begin a pointer
drag without triggering editing, removal or completion. Controls MUST NOT be
offered on an item without a parent. A handle MUST move its substep only inside
its own parent and priority group.

#### Scenario: Substeps show a handle

- **WHEN** a parent action displays its one-level substeps
- **THEN** each displayed substep shows a visible drag handle with a French
  accessible name

#### Scenario: Handle name includes substep and priority

- **WHEN** a handle is rendered for a substep
- **THEN** its accessible name contains the substep title, its priority and an
  indication that it belongs to its parent action

#### Scenario: Top-level actions keep their own controls

- **WHEN** a top-level action is rendered
- **THEN** it shows the top-level handle and offers the top-level move commands
  through its menu, not the substep controls

#### Scenario: Handle does not trigger other controls

- **GIVEN** a substep is displayed
- **WHEN** the user activates « Modifier », « Retirer » or the completion checkbox
- **THEN** no drag starts and the substep is not moved

### Requirement: Accessible move controls

Every substep SHALL expose, through its per-item actions menu, keyboard- and
touch-operable French « Monter » and « Descendre » controls that move it exactly
one rank inside its parent and priority group, with accessible names naming the
substep, its priority and its parent, disabled at the group boundaries, never
changing priority, and announcing success.

#### Scenario: Move one rank inside the group

- **GIVEN** a parent+priority group with several substeps
- **WHEN** the user activates « Monter » or « Descendre » on a member
- **THEN** it swaps with its immediate neighbour in that group only

#### Scenario: Boundaries disable the controls

- **GIVEN** a substep is first or last in its parent+priority group
- **WHEN** the list is rendered
- **THEN** the impossible move control is disabled

#### Scenario: Same result as an adjacent drop

- **WHEN** a move control is activated
- **THEN** the resulting order equals an adjacent drag-and-drop of the same rank

#### Scenario: Keyboard operation announces success

- **GIVEN** a keyboard-only user
- **WHEN** a substep move control is activated
- **THEN** the move succeeds, a French message announces it, and focus remains
  usable
