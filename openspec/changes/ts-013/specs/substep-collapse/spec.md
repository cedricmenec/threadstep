# Spec Delta

## MODIFIED Requirements

### Requirement: Disclosure control on parents with visible substeps

A top-level action that has at least one substep visible under the current
filters SHALL expose a visible French disclosure control. Actions without a
visible substep, and substeps themselves, MUST NOT expose this control.

#### Scenario: Parent with visible substeps shows the control

- **GIVEN** a top-level action has at least one substep visible under the current
  filters
- **WHEN** the list is rendered
- **THEN** that action shows a visible disclosure control whose label reflects
  the visible substep count

#### Scenario: Parent without visible substeps shows no control

- **GIVEN** a top-level action has no substep
- **WHEN** the list is rendered
- **THEN** that action shows no collapse control

#### Scenario: Substeps show no control

- **GIVEN** a subject displays a one-level substep
- **WHEN** the list is rendered
- **THEN** that substep shows no collapse control, even if it has no children

### Requirement: Native and accessible control

The control SHALL be a native `button` element of `type="button"`, operable with
mouse, touch and keyboard (Tab, Enter, Space), with an accessible name that
includes its current visible label and the parent action's title, and a touch
target of at least 44 × 44 px.

#### Scenario: Keyboard operation

- **GIVEN** a keyboard-only user
- **WHEN** the control receives focus via Tab and is activated with Enter or
  Space
- **THEN** the substeps are collapsed or expanded without a pointer

#### Scenario: Mouse and touch activation

- **WHEN** the control is clicked or tapped
- **THEN** the substeps are collapsed or expanded

#### Scenario: Accessible name names the action

- **WHEN** a control is rendered for an action
- **THEN** its accessible name contains the control's current visible label and
  identifies the parent action

#### Scenario: Touch target large enough

- **WHEN** a control is rendered
- **THEN** its touch target is at least 44 × 44 px

## ADDED Requirements

### Requirement: Collapse label shows the visible substep count

When a parent is collapsed, its control's visible label SHALL be
« Voir 1 sous-tâche » for exactly one visible direct substep and
« Voir N sous-tâches » for N (N > 1) visible direct substeps. When the parent is
expanded, the label SHALL be « Masquer les sous-tâches ».

#### Scenario: One visible substep

- **GIVEN** a collapsed parent has exactly one visible direct substep
- **WHEN** the list is rendered
- **THEN** the control's text is exactly « Voir 1 sous-tâche »

#### Scenario: Several visible substeps

- **GIVEN** a collapsed parent has N (N > 1) visible direct substeps
- **WHEN** the list is rendered
- **THEN** the control's text is exactly « Voir N sous-tâches » with the actual
  count

#### Scenario: Expanded label

- **GIVEN** a parent is expanded with at least one visible direct substep
- **WHEN** the list is rendered
- **THEN** the control's text is exactly « Masquer les sous-tâches »

#### Scenario: Toggling updates the label

- **GIVEN** a collapsed parent with two visible direct substeps shows
  « Voir 2 sous-tâches »
- **WHEN** the control is activated
- **THEN** the substeps are shown and the label becomes
  « Masquer les sous-tâches », and a second activation restores
  « Voir 2 sous-tâches »

### Requirement: Count follows the completion filter and child changes

The count SHALL include only the direct substeps visible under the current
« Masquer les étapes terminées » filter, independent of whether those substeps
are themselves collapsed, and SHALL be refreshed on the next render after a
substep is added, removed, restored, completed or filtered.

#### Scenario: Count without the filter

- **GIVEN** a collapsed parent has three direct substeps, one of them completed,
  and « Masquer les étapes terminées » is inactive
- **WHEN** the list is rendered
- **THEN** the label is « Voir 3 sous-tâches »

#### Scenario: Filter reduces the count

- **GIVEN** a collapsed parent has three direct substeps, one of them completed,
  and « Masquer les étapes terminées » is active
- **WHEN** the list is rendered
- **THEN** the label is « Voir 2 sous-tâches » and expanding reveals only the
  unfinished substep

#### Scenario: Count independent of child collapse

- **GIVEN** a collapsed parent has several direct substeps, some of which are
  themselves collapsed
- **WHEN** the list is rendered
- **THEN** the count equals all direct visible substeps regardless of their own
  collapse

#### Scenario: Refreshed after a child change

- **GIVEN** a collapsed parent shows a count for its visible direct substeps
- **WHEN** a direct substep is added, removed, restored or completed
- **THEN** the next render shows the updated count without changing any other
  parent's collapse state

#### Scenario: No control when the filter hides every direct substep

- **GIVEN** the filter hides every direct substep of a parent
- **WHEN** the list is rendered
- **THEN** that parent shows no disclosure control
