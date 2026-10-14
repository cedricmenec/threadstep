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
