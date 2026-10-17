# Spec Delta

## MODIFIED Requirements

### Requirement: Promotion command on direct substeps

Every rendered direct substep (`parentId` not `null`) SHALL expose a French
« Promouvoir en tâche principale » command through its per-item actions menu in
both the overview and the detail view. A top-level task (`parentId: null`) MUST
NOT expose it, and promotion MUST NOT create a second substep level.

#### Scenario: Overview substep shows the command

- **WHEN** a subject displays a direct substep in the overview
- **THEN** that substep offers a « Promouvoir en tâche principale » command in its actions menu

#### Scenario: Detail view substep shows the command

- **WHEN** a subject displays a direct substep in the detail view
- **THEN** that substep offers the same promotion command in its actions menu as in the overview

#### Scenario: Top-level task shows no command

- **WHEN** a subject displays a top-level task
- **THEN** no promotion command is offered for that task

#### Scenario: No second nesting level

- **WHEN** a direct substep is promoted
- **THEN** no second substep level is created and no other item changes level
