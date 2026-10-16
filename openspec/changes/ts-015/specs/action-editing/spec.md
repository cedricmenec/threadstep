# Spec Delta

## ADDED Requirements

### Requirement: Interactive priority badge

Every rendered top-level action and one-level substep SHALL expose its priority
through an interactive French control that keeps the existing Urgent / Normal /
Plus tard badge appearance, replacing the decorative badge. It MUST be operable
by mouse, touch, Tab, Enter and Space, expose an accessible name naming the item
and its current priority, and provide a touch target of at least 44 × 44 px with
a visible focus state.

#### Scenario: Top-level action exposes the control

- **WHEN** a subject displays a top-level action
- **THEN** its priority appears as an interactive control, not a decorative badge

#### Scenario: Substep exposes the control

- **WHEN** a parent action displays a one-level substep
- **THEN** that substep also shows the interactive priority control

#### Scenario: Accessible name names the item and its priority

- **WHEN** the priority control is rendered for an item
- **THEN** its accessible name contains the item title and its current priority

#### Scenario: Keyboard activation opens the choices

- **GIVEN** keyboard focus is on the priority control
- **WHEN** the user presses Enter or Space
- **THEN** the three priority choices are offered and the current one is indicated

#### Scenario: Touch target and focus are visible

- **WHEN** the priority control is displayed
- **THEN** it is at least 44 × 44 px and shows a visible focus indicator when focused

### Requirement: Explicit choice among the priorities

Activating the control SHALL offer exactly Urgent, Normal and Plus tard and mark
the current priority. Choosing a different priority SHALL change only the
targeted action or substep, immediately update its badge and visual priority
class, persist the document locally, and re-display steps in the existing
priority groups.

#### Scenario: Choosing a different priority applies to the targeted item

- **WHEN** the user opens the badge of a Normal action and chooses Urgent
- **THEN** that action shows Urgent and no other item's priority changes

#### Scenario: The item is displayed in its new group

- **WHEN** a priority change is applied
- **THEN** the item is shown in its new priority group in the existing
  urgent → normal → later order

#### Scenario: A substep keeps its parent

- **GIVEN** a substep of parent P
- **WHEN** its priority changes
- **THEN** its `parentId` is still P and P is unchanged

#### Scenario: A valid change is saved once

- **WHEN** a valid priority change is applied
- **THEN** exactly one storage write occurs

### Requirement: No-op selection leaves data untouched

Choosing the priority that is already selected, closing the choice without
selecting, or pressing Escape MUST NOT write the document, the local storage or
the exported JSON, and MUST leave every field and the display unchanged.

#### Scenario: Re-selecting the current priority writes nothing

- **WHEN** the user opens the control and selects the current priority
- **THEN** the document, localStorage and the export are unchanged

#### Scenario: Closing without a choice writes nothing

- **WHEN** the user closes the choice without selecting, or presses Escape
- **THEN** no priority changes and nothing is written

### Requirement: Priority change preserves identity and hierarchy

A priority change SHALL modify only the targeted item's `priority`. Its id,
title, `done` flag, `parentId`, subject membership and every other item's fields
and relative order MUST be preserved, no item is re-parented, and the document
MUST keep the `threadstep.document.v1` shape.

#### Scenario: Identity and completion preserved

- **WHEN** an item's priority is changed
- **THEN** its id, title, `done` flag, `parentId` and subject membership are
  unchanged

#### Scenario: Other items keep their data and order

- **WHEN** one item's priority changes
- **THEN** every other item keeps its fields and its relative order inside each
  priority group

#### Scenario: No re-parenting

- **WHEN** the priority of a top-level action or a substep changes
- **THEN** no `parentId` changes and no item changes level

### Requirement: Badge does not trigger other controls

Activating the priority control MUST NOT start a drag, toggle completion,
collapse or expand substeps, remove the item, or open the title editor.

#### Scenario: Activating the control starts no other action

- **GIVEN** an action is displayed with its controls
- **WHEN** the user activates the priority control
- **THEN** no drag starts, completion is unchanged, substeps keep their state, the
  item is not removed and the title editor does not open

#### Scenario: Existing controls still work

- **WHEN** the completion checkbox, « Modifier », « Retirer », the collapse
  control or a drag handle is activated
- **THEN** it behaves as before the priority control was introduced

### Requirement: No stale state across the app

After a priority change the pending counter, the deterministic suggestion, the
« Je reprends ici » tracking, the filtered list, the priority grouping and the
full « Modifier » editor SHALL reflect the new priority with no stale state. The
editor's priority setting MUST remain available.

#### Scenario: Suggestion and counter follow the new priority

- **GIVEN** a document with a suggested action and a pending count
- **WHEN** an action's priority changes
- **THEN** the pending counter and the deterministic suggestion follow the new
  priority from the current document

#### Scenario: The full editor shows the new priority

- **WHEN** the priority was changed from the badge and « Modifier » is opened for
  that item
- **THEN** the editor's priority selector shows the new priority

#### Scenario: Tracking uses stable ids

- **GIVEN** an action is tracked as « Je reprends ici »
- **WHEN** a priority is changed
- **THEN** the tracked action and its card stay coherent with stable ids

### Requirement: Persistence and portability of a priority change

A priority change SHALL persist through the existing automatic localStorage
write, survive a reload, and survive a JSON export/import round-trip without a
new field, a new storage key or a document version change.

#### Scenario: Reload retains the priority

- **WHEN** a priority is changed and the page is reloaded
- **THEN** the new priority is restored from localStorage

#### Scenario: Export and import round-trip

- **WHEN** a document with changed priorities is exported and re-imported
- **THEN** the priorities and every other field are preserved

#### Scenario: Storage compatibility

- **WHEN** the change ships
- **THEN** the storage key remains `threadstep.document.v1` and the version
  remains 1

### Requirement: Accessible, mobile and safe priority control

The control, its choices and its labels SHALL remain French with an accessible
name naming the item and its priority. It MUST work with mouse, touch and
keyboard on a narrow viewport, any animation MUST respect
`prefers-reduced-motion`, and titles and priorities SHALL render as text nodes,
never as HTML.

#### Scenario: Touch operation on a narrow viewport

- **GIVEN** a narrow touch viewport
- **WHEN** the user taps the priority control and chooses a priority
- **THEN** the priority is applied and the row stays readable

#### Scenario: Reduced motion honored

- **GIVEN** `prefers-reduced-motion` is enabled
- **WHEN** the priority control is used
- **THEN** no non-essential animation is played

#### Scenario: Markup shown literally

- **WHEN** an item title contains markup such as `<img src=x onerror=alert(1)>`
- **THEN** it is displayed literally and creates no element
