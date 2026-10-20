# Spec Delta

## MODIFIED Requirements

### Requirement: Transient tab-local state

The collapse state SHALL be tab-local, start collapsed at document load, on
direct detail entry and on every view entry for every parent with at least one
visible substep, and reset on a change of view, reload, new tab, successful JSON
import or authorized identity change. It SHALL survive local mutations and
asynchronous data refreshes in the current view, including Cloud sync completion
and inter-tab notifications, under the same authorized identity. It MUST NOT be
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

#### Scenario: Checking a subtask keeps the group open

- **GIVEN** two parent groups are expanded in the current view
- **WHEN** a direct substep of the first parent is checked or unchecked
- **THEN** both parents remain expanded
- **AND** the first parent still shows its remaining visible substeps and its
  control keeps an exact `aria-expanded="true"`

#### Scenario: Cloud sync completion is not a view entry

- **GIVEN** a parent is expanded and the current workspace identity is authorized
- **WHEN** Dexie Cloud signals a sync completion and refreshes the same view
- **THEN** that parent remains expanded if it still has a visible substep
- **AND** no reload or view-entry reset is triggered by that event alone

#### Scenario: Inter-tab notification is not a view entry

- **GIVEN** several parents are voluntarily expanded in the current tab
- **WHEN** another tab changes data and the current tab receives the notification
- **THEN** the parents that are still present and visible keep their expansion
- **AND** no collapse or expansion preference is written to storage

#### Scenario: Refresh after removing the last visible child

- **GIVEN** a parent is expanded and the completion filter is active
- **WHEN** a data refresh leaves that parent without any visible direct substep
- **THEN** its disclosure control is absent
- **AND** the expansion state of the other visible parents is unchanged

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

#### Scenario: Cancelled or failed import keeps expansion

- **GIVEN** a parent is expanded
- **WHEN** a JSON import is previewed but cancelled, refused, collides or fails
  without writing
- **THEN** the parent remains expanded and no data or expansion state is written

#### Scenario: Authorized identity change resets expansion

- **GIVEN** a parent is expanded in an authorized workspace
- **WHEN** a different workspace identity or account becomes authorized and its
  data is displayed
- **THEN** every parent of the displayed view starts collapsed
- **AND** no expansion state from the previous workspace is reused or exposed

#### Scenario: Transient binding re-evaluation preserves expansion

- **GIVEN** a parent is expanded under an authorized workspace
- **WHEN** the same identity is re-evaluated or temporarily hidden during a
  binding check and then displayed again
- **THEN** that parent remains expanded
- **AND** business data stays masked for as long as the binding does not
  authorize it
