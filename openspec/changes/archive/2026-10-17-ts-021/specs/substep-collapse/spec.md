# Spec Delta

## MODIFIED Requirements

### Requirement: Transient tab-local state

The collapse state SHALL be local to the current tab and start collapsed. At
document load, on a direct detail entry and on every entry into a view, every
parent with at least one visible substep SHALL be collapsed. The state SHALL
survive ordinary re-renders within the current view and SHALL reset to collapsed
on a change of view, a reload, a new tab and a JSON import. It MUST NOT be
persisted.

#### Scenario: Starts collapsed in the overview after load

- **GIVEN** the document contains a parent with visible substeps
- **WHEN** the overview is loaded
- **THEN** that parent is collapsed and its control shows a « Voir N sous-tâches »
  label

#### Scenario: Starts collapsed on a direct detail entry

- **GIVEN** the document contains a parent with visible substeps
- **WHEN** a valid `#/sujet/<id>` route is loaded directly
- **THEN** the parent is collapsed

#### Scenario: Changing view resets expansion

- **GIVEN** a parent is expanded in the overview
- **WHEN** the user opens the detail view, or returns to the overview, or opens
  another project
- **THEN** every parent of the newly displayed view is collapsed

#### Scenario: Back and Forward reset expansion

- **GIVEN** a parent is expanded in one view
- **WHEN** the user presses Back or Forward to another view
- **THEN** every parent of the newly displayed view is collapsed

#### Scenario: Survives ordinary re-render and save

- **GIVEN** a parent is expanded
- **WHEN** an ordinary operation re-renders the same view, such as editing,
  changing a priority, completing a step, reordering, toggling the filter or a
  notification
- **THEN** that parent stays expanded

#### Scenario: Reset after reload

- **GIVEN** a parent is expanded
- **WHEN** the page is reloaded
- **THEN** every parent is displayed collapsed

#### Scenario: Reset in a new tab

- **GIVEN** a parent is expanded in one tab
- **WHEN** the document is opened in a new tab
- **THEN** every parent is displayed collapsed

#### Scenario: Reset after import

- **GIVEN** a parent is expanded
- **WHEN** a JSON document is imported successfully
- **THEN** every parent is displayed collapsed

## ADDED Requirements

### Requirement: Childless parents stay collapsed when a substep is added

A top-level task that had no visible substep SHALL remain collapsed on the
render that first shows an added substep, and a parent that was voluntarily
expanded SHALL keep its expansion when a substep is added. Adding a substep MUST
NOT persist any collapse or expansion state.

#### Scenario: First child starts collapsed

- **GIVEN** a top-level task has no substep
- **WHEN** its first direct substep is added
- **THEN** the task renders collapsed with a « Voir 1 sous-tâche » control and
  the new substep is not focusable

#### Scenario: Expanded parent keeps its expansion on add

- **GIVEN** a parent with visible substeps is expanded
- **WHEN** another direct substep is added
- **THEN** the parent stays expanded and shows the new substep

#### Scenario: Adding writes nothing

- **WHEN** a substep is added
- **THEN** no collapse or expansion state is saved and the exported JSON contains
  only the added item

### Requirement: Temporary expansion to reveal a descendant

When an explicit reveal (« Voir dans la liste », removal undo) targets a direct
substep whose parent is collapsed, the interface SHALL expand that ancestor for
the reveal, show and focus the target, and MUST NOT persist or save the
expansion. A subsequent view entry SHALL reset that expansion to collapsed.

#### Scenario: Revealing a hidden substep expands its parent

- **GIVEN** a direct substep is hidden by a collapsed parent
- **WHEN** an explicit reveal targets that substep
- **THEN** its parent is expanded, the substep is rendered with its reveal cue
  and focus is placed on it

#### Scenario: Revealing a top-level action is unchanged

- **GIVEN** an explicit reveal targets a top-level action
- **WHEN** it is revealed
- **THEN** no ancestor is expanded, the action keeps its reveal cue and focus

#### Scenario: Reveal writes nothing

- **WHEN** a descendant is revealed
- **THEN** no localStorage write occurs and the document, its ids, order,
  priorities, completion flags and parent relations are unchanged

#### Scenario: Next view entry collapses again

- **GIVEN** a parent was temporarily expanded to reveal a descendant
- **WHEN** the user leaves and re-enters the view
- **THEN** every parent of the displayed view is collapsed
