# action-editing Specification

## Purpose
Editing an existing action or one-level substep in place, preserving its
identity, completion flag, hierarchy and locally stored document.

## Requirements

### Requirement: Edit control for each action

Every rendered action SHALL expose a visible French « Modifier » control,
including one-level substeps. The control MUST be operable by keyboard and by
touch and MUST expose an accessible name identifying the action being edited.

#### Scenario: Top-level action offers an edit control

- **WHEN** a subject displays a next action
- **THEN** that action shows a « Modifier » control with an accessible label
  naming the action

#### Scenario: Substep offers an edit control

- **WHEN** a subject displays a one-level substep
- **THEN** that substep shows its own « Modifier » control

### Requirement: Inline editor prefill

Activating the edit control SHALL replace the action's display with an inline
editor in the same list position. The editor MUST be prefilled with the action's
current title and its current priority selected among urgent, normal and later,
and MUST provide « Enregistrer » and « Annuler » controls.

#### Scenario: Editor shows current values

- **WHEN** the user activates « Modifier » for an action
- **THEN** an inline editor appears containing the current title and the current
  priority selected

#### Scenario: Save and cancel are available

- **WHEN** the inline editor is shown
- **THEN** both « Enregistrer » and « Annuler » controls are available

### Requirement: Save changes title and priority only

Saving an edit SHALL change only the action's `title` and `priority`. The
action's `id`, `done`, `parentId`, subject membership and every other field MUST
be preserved, and the document MUST keep the `threadstep.document.v1` shape.

#### Scenario: Rename and reprioritize

- **WHEN** the user renames an action and sets a different priority and saves
- **THEN** the visible title and priority badge show the new values

#### Scenario: Identity and completion preserved

- **WHEN** an action is edited and saved
- **THEN** its id, done flag, parentId and subject membership are unchanged

### Requirement: Parent and substep hierarchy preserved

Editing a parent action MUST NOT modify, lose or re-parent its substeps.
Editing a substep MUST NOT change its parent.

#### Scenario: Parent edit keeps its substeps

- **WHEN** a parent action with nested substeps is renamed and reprioritized and
  saved
- **THEN** its id, done flag and every substep's `parentId` remain unchanged

#### Scenario: Substep edit keeps its parent

- **WHEN** a substep is renamed and reprioritized and saved
- **THEN** its `parentId` and its parent action remain unchanged

### Requirement: Cancel discards edits

« Annuler » SHALL close the inline editor without changing the stored document,
leaving the original title and priority intact and persisting no draft value.

#### Scenario: Cancel leaves data intact

- **WHEN** the user changes the title or priority and activates « Annuler »
- **THEN** the editor closes and the original title and priority remain

### Requirement: Title validation

A save SHALL trim surrounding whitespace from the title. A blank or
whitespace-only title, or a trimmed title longer than 300 characters, MUST be
rejected; the stored action SHALL remain unchanged and an understandable
validation indication MUST be shown.

#### Scenario: Blank title rejected

- **WHEN** the user clears the title or enters only whitespace and saves
- **THEN** the action is not modified and a validation indication is shown

#### Scenario: Too-long title rejected

- **WHEN** the trimmed title exceeds 300 characters and the user saves
- **THEN** the action is not modified and a validation indication is shown

#### Scenario: Surrounding whitespace trimmed

- **WHEN** the user saves a title with leading or trailing whitespace
- **THEN** the stored title is trimmed

### Requirement: Priority order after save

After a successful save the document SHALL continue to display actions in the
existing priority order within their hierarchy level, and the relative order of
other actions and of subjects MUST NOT change.

#### Scenario: Reprioritized action reorders within its level

- **WHEN** an action's priority changes from normal to urgent and is saved
- **THEN** it is displayed before lower-priority actions at the same level

#### Scenario: Unrelated ordering unchanged

- **WHEN** any action is edited and saved
- **THEN** the relative order of the other actions and of the subjects is
  unchanged

### Requirement: Persistence and portability

A saved edit SHALL persist through the existing automatic localStorage write and
SHALL survive a reload in the same browser. JSON export followed by import MUST
preserve the updated title and priority together with every other document
field, without increasing the schema version or changing the storage key.

#### Scenario: Reload retains the edit

- **WHEN** an edit is saved and the page is reloaded
- **THEN** the updated title and priority are restored from localStorage

#### Scenario: Export and import round-trip

- **WHEN** a document with edited actions is exported and re-imported
- **THEN** the updated fields and every other field are preserved

#### Scenario: Storage compatibility

- **WHEN** the change ships
- **THEN** the storage key remains `threadstep.document.v1` and the version
  remains 1

### Requirement: Accessible focus after save or cancel

After saving or cancelling, focus SHALL move to a sensible, deterministic
target: the « Modifier » control of the edited action. When a priority change
re-renders that action at a new position, focus MUST follow the same action.

#### Scenario: Focus after save

- **WHEN** an edit is saved
- **THEN** keyboard focus is placed on the edited action's « Modifier » control

#### Scenario: Focus after cancel

- **WHEN** an edit is cancelled
- **THEN** keyboard focus is placed on the edited action's « Modifier » control

### Requirement: Safe text rendering

Edited and displayed titles SHALL be rendered as text nodes. User-provided text
MUST NOT be interpreted as HTML or injected into the document.

#### Scenario: Markup shown literally

- **WHEN** a saved title contains markup such as `<img src=x onerror=alert(1)>`
- **THEN** the text is displayed literally and no element is created from it

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
