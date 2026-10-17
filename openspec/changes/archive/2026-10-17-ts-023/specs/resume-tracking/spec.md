# Spec Delta

## MODIFIED Requirements

### Requirement: Pin control on eligible actions

Every unfinished top-level action SHALL expose, through its per-item actions
menu, a French control that defines it as the tracked action. The command MUST be
operable by keyboard and by touch and MUST expose an accessible name naming the
action. Completed top-level actions and substeps MUST NOT expose this command.

#### Scenario: Unfinished top-level action offers the control

- **GIVEN** a subject displays an unfinished top-level action
- **WHEN** the list is rendered
- **THEN** that action offers a « Garder le fil » command in its actions menu with an accessible name
  naming the action

#### Scenario: Substeps are not eligible

- **GIVEN** a subject displays a substep
- **WHEN** the list is rendered
- **THEN** the substep offers no « Garder le fil » command

#### Scenario: Completed top-level actions are not eligible

- **GIVEN** a top-level action is done
- **WHEN** the list is rendered
- **THEN** that completed action offers no « Garder le fil » command

#### Scenario: Keyboard activation

- **GIVEN** a keyboard user focuses an eligible action's control
- **WHEN** the control is activated
- **THEN** that action becomes the tracked action without using a pointer

#### Scenario: Touch activation

- **GIVEN** the control is tapped on a touch device
- **WHEN** the tap is registered
- **THEN** that action becomes the tracked action
