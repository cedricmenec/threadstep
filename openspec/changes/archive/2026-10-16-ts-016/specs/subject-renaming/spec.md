# Spec Delta

## Purpose

Renames an existing subject's title from the detail view with validation and a
targeted update that preserves its identity, steps, relations and stored
document.

## ADDED Requirements

### Requirement: Rename control and explicit form

The detail view SHALL expose a French « Renommer le projet » control that opens
an explicit form prefilled with the current name and providing an
« Enregistrer » action and an « Annuler » action.

#### Scenario: Rename control is present

- **WHEN** the detail view renders
- **THEN** « Renommer le projet » is available

#### Scenario: Explicit form with both actions

- **WHEN** the rename control is activated
- **THEN** a form prefilled with the current title and both « Enregistrer » and
  « Annuler » actions are shown

#### Scenario: Cancel returns to the detail view

- **WHEN** « Annuler » is activated
- **THEN** the form closes and the rename control is available again

### Requirement: Title validation

A rename SHALL trim surrounding whitespace and reject a blank or
whitespace-only name or a trimmed name longer than 100 characters. Cancellation,
an invalid name or an unchanged name MUST save nothing and MUST NOT write the
document, localStorage or the exported JSON.

#### Scenario: Blank name rejected

- **WHEN** the name is empty or only whitespace and the user saves
- **THEN** nothing changes and a validation indication is shown

#### Scenario: Too-long name rejected

- **WHEN** the trimmed name exceeds 100 characters and the user saves
- **THEN** nothing changes and a validation indication is shown

#### Scenario: Cancel saves nothing

- **WHEN** « Annuler » is activated
- **THEN** the original name remains and nothing is written

#### Scenario: Unchanged name saves nothing

- **WHEN** the same name is saved
- **THEN** no write occurs and the document is unchanged

### Requirement: Targeted update preserves everything else

A valid rename SHALL modify only the `title` of the subject matching the id. Its
`id`, items, `parentId`s, orders and priorities MUST be preserved, and the
overview and any other reference SHALL show the new name.

#### Scenario: Only the title changes

- **WHEN** a valid rename is saved
- **THEN** only the subject's title changes and its id and steps are unchanged

#### Scenario: Overview shows the new name

- **WHEN** a valid rename is saved in the detail view
- **THEN** the overview card of that subject shows the new name

#### Scenario: No identity or relation change

- **WHEN** a rename is persisted
- **THEN** no item id, `parentId`, order or priority changes

### Requirement: Persistence and portability

A valid rename SHALL persist through the existing automatic document write,
survive a reload, and survive a JSON export/import round-trip, without a new
field, storage key or document version change and without any migration.

#### Scenario: Reload retains the name

- **WHEN** a rename is saved and the page is reloaded
- **THEN** the new name is restored from localStorage

#### Scenario: Export and import round-trip

- **WHEN** the renamed document is exported and then re-imported
- **THEN** the new name and every other field are preserved

#### Scenario: No migration

- **WHEN** the rename ships
- **THEN** the storage key remains `threadstep.document.v1`, the version stays 1
  and no migration is added

### Requirement: Coherence across views

After a valid rename the detail header and the overview card SHALL update
immediately, and the pending counter, « Une étape pour maintenant »,
« Je reprends ici » and the JSON export SHALL reflect the new name with no stale
state.

#### Scenario: Immediate update

- **WHEN** the rename is saved
- **THEN** the detail title and the overview card immediately show the new name

#### Scenario: Other features follow the document

- **WHEN** the name changes
- **THEN** the counter, the suggestion, the tracking and the export follow the
  current document

#### Scenario: Tracking uses stable ids

- **GIVEN** a tracked action belongs to the renamed subject
- **WHEN** the subject is renamed
- **THEN** the tracking stays coherent with stable ids

### Requirement: Accessible, mobile and safe rename

The rename control and form SHALL be French and operable by keyboard (Tab,
Enter), mouse and touch, with a visible focus, touch targets of at least
44 × 44 px and an accessibly announced validation indication. The subject name
SHALL render as a text node, never as HTML.

#### Scenario: Keyboard operation

- **WHEN** a keyboard-only user renames and saves or cancels
- **THEN** both paths are possible and focus stays on a sensible control

#### Scenario: Validation is announced

- **WHEN** a name is rejected
- **THEN** the indication is exposed through an accessible role

#### Scenario: Markup shown literally

- **WHEN** a submitted name contains markup such as `<img src=x onerror=alert(1)>`
- **THEN** it is displayed literally and creates no element
