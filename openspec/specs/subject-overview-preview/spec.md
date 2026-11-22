# subject-overview-preview Specification

## Purpose

Keep the project overview focused on project navigation. Task lists and task
management are available after opening the project detail.

## Requirements

### Requirement: No task preview in Overview

Overview SHALL NOT present task rows, task previews or task commands inside
project cards. Hidden task content MUST NOT be perceivable or reachable by
keyboard. Opening a project SHALL provide access to its existing task list and
management controls without changing stored data.

#### Scenario: Project cards contain no task preview

- **WHEN** the overview project list is rendered
- **THEN** each card presents project navigation and its canonical counts
- **AND** no task row, preview entry or task action is visible or keyboard reachable

#### Scenario: Tasks remain available in project detail

- **GIVEN** a project with tasks
- **WHEN** its project card is opened
- **THEN** the existing detail route presents the project's task list and controls
- **AND** the task records, ordering and relationships are unchanged

#### Scenario: No implicit task mutation

- **WHEN** the overview is rendered or a project is opened
- **THEN** hiding task previews and opening the detail create no task mutation,
  storage key or persistent preference
