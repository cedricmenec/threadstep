# Spec Delta

## MODIFIED Requirements

### Requirement: Edit control for each action

Every rendered action SHALL expose a French « Modifier » command through its
per-item actions menu, including one-level substeps. The command MUST be operable
by keyboard and by touch and MUST expose an accessible name identifying the
action being edited.

#### Scenario: Top-level action offers an edit control

- **WHEN** a subject displays a next action
- **THEN** that action offers a « Modifier » command in its actions menu with an
  accessible label naming the action

#### Scenario: Substep offers an edit control

- **WHEN** a subject displays a one-level substep
- **THEN** that substep offers its own « Modifier » command in its actions menu
