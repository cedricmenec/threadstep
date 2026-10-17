# Spec Delta

## MODIFIED Requirements

### Requirement: Accessible move controls

Every top-level action SHALL expose, through its per-item actions menu,
keyboard- and touch-operable French « Monter » and « Descendre » controls that
move it exactly one rank inside its priority group, with accessible names naming
the action and its priority, disabled at the group boundaries, never changing
priority, and announcing success. The drag handle SHALL stay directly visible on
the row.

#### Scenario: Move one rank inside the group

- **GIVEN** a priority group with several top-level actions
- **WHEN** the user activates « Monter » or « Descendre » on a member
- **THEN** it swaps with its immediate neighbour in that priority group only

#### Scenario: Boundaries disable the controls

- **GIVEN** an action is first or last in its priority group
- **WHEN** the list is rendered
- **THEN** the impossible move control is disabled

#### Scenario: Same result as an adjacent drop

- **WHEN** a move control is activated
- **THEN** the resulting order equals an adjacent drag-and-drop of the same rank

#### Scenario: Keyboard operation announces success

- **GIVEN** a keyboard-only user
- **WHEN** a move control is activated
- **THEN** the move succeeds, a message announces it, and focus remains usable
