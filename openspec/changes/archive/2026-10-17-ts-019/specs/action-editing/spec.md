# Spec Delta

## MODIFIED Requirements

### Requirement: Inline editor prefill

Activating the edit control SHALL replace the action's display with an inline
editor in the same list position. The editor MUST be prefilled with the action's
current title, its current priority selected among urgent, normal and later, and
its current optional note (or an empty note control), and MUST provide
« Enregistrer » and « Annuler » controls.

#### Scenario: Editor shows current values

- **WHEN** the user activates « Modifier » for an action
- **THEN** an inline editor appears containing the current title and the current
  priority selected

#### Scenario: Editor shows the current note

- **WHEN** the user activates « Modifier » for an action that has a note
- **THEN** the multiline note control contains that note

#### Scenario: Save and cancel are available

- **WHEN** the inline editor is shown
- **THEN** both « Enregistrer » and « Annuler » controls are available

### Requirement: Save changes title and priority only

Saving an edit SHALL change only the action's `title`, `priority` and optional
`note`. The action's `id`, `done`, `parentId`, subject membership and every other
field MUST be preserved, and the document MUST keep the
`threadstep.document.v1` shape.

#### Scenario: Rename and reprioritize

- **WHEN** the user renames an action and sets a different priority and saves
- **THEN** the visible title and priority badge show the new values

#### Scenario: Save the optional note

- **WHEN** the user enters, changes or clears the note and saves
- **THEN** only the note is added, updated or removed and the other fields are
  unchanged

#### Scenario: Identity and completion preserved

- **WHEN** an action is edited and saved
- **THEN** its id, done flag, parentId and subject membership are unchanged
