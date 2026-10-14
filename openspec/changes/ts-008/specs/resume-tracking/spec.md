# Spec Delta

## Purpose

Lets the user deliberately pin one unfinished top-level action as the current
« Je reprends ici », persist that choice as a browser-local preference, restore
it after an interruption, reveal it accessibly and clear it safely.

## ADDED Requirements

### Requirement: Pin control on eligible actions

Every unfinished top-level action SHALL expose a visible French control that
defines it as the tracked action. The control MUST be operable by keyboard and
by touch and MUST expose an accessible name naming the action. Completed
top-level actions and substeps MUST NOT expose this control.

#### Scenario: Unfinished top-level action offers the control

- **GIVEN** a subject displays an unfinished top-level action
- **WHEN** the list is rendered
- **THEN** that action shows a « Garder le fil » control with an accessible name
  naming the action

#### Scenario: Substeps are not eligible

- **GIVEN** a subject displays a substep
- **WHEN** the list is rendered
- **THEN** the substep shows no « Garder le fil » control

#### Scenario: Completed top-level actions are not eligible

- **GIVEN** a top-level action is done
- **WHEN** the list is rendered
- **THEN** that completed action shows no « Garder le fil » control

#### Scenario: Keyboard activation

- **GIVEN** a keyboard user focuses an eligible action's control
- **WHEN** the control is activated
- **THEN** that action becomes the tracked action without using a pointer

#### Scenario: Touch activation

- **GIVEN** the control is tapped on a touch device
- **WHEN** the tap is registered
- **THEN** that action becomes the tracked action

### Requirement: Single tracked action

The app SHALL track at most one action per document. Defining another action as
tracked MUST replace the previous reference and MUST NOT modify any action's
identifier, priority, completion flag, parent relation or order.

#### Scenario: Defining an action shows a single card

- **GIVEN** no action is tracked
- **WHEN** the user defines action A
- **THEN** exactly one « Je reprends ici » card is shown for A

#### Scenario: Defining another action replaces the first

- **GIVEN** action A is tracked
- **WHEN** the user defines action B
- **THEN** the card shows B and no card remains for A

#### Scenario: Tracking leaves actions unchanged

- **GIVEN** a document with several actions
- **WHEN** the user defines one of them
- **THEN** every action's identifier, priority, completion flag, parent relation
  and the subject and item order are unchanged

### Requirement: Resume card content

WHEN a valid tracked action exists, the app SHALL show exactly one « Je reprends
ici » card at the top of the interface with the subject name, the action title
and the priority, plus « Voir dans la liste » and « Ne plus suivre » controls.

#### Scenario: Card shows the tracked action

- **GIVEN** action A is tracked
- **WHEN** the card is shown
- **THEN** it displays A's subject name, title and priority and no second action

#### Scenario: No card when nothing is tracked

- **GIVEN** no action is tracked
- **WHEN** the dashboard is displayed
- **THEN** no « Je reprends ici » card is shown

### Requirement: Local persistence and restore

The tracked reference SHALL be stored in a browser-local preference separate from
the `threadstep.document.v1` document and SHALL be restored after a reload
without network access. It MUST be keyed by the stable subject and action
identifiers, never by title or list position.

#### Scenario: Reload restores the tracked action

- **GIVEN** action A is tracked
- **WHEN** the page is reloaded in the same browser
- **THEN** the card for A is restored without a network request

#### Scenario: Renaming and reordering do not break tracking

- **GIVEN** action A is tracked
- **WHEN** A is renamed, reprioritized or its subject is reordered and the page
  is reloaded
- **THEN** A remains tracked and the card shows its updated title, priority and
  subject

#### Scenario: No tracking after a clean session

- **GIVEN** the user never defined a tracked action
- **WHEN** the page is reloaded
- **THEN** no « Je reprends ici » card is shown

### Requirement: Reveal the tracked action

WHEN the user activates « Voir dans la liste », the tracked action SHALL be
brought into view and receive keyboard-accessible focus or a visible highlight,
including at a mobile viewport and when completed actions are hidden.

#### Scenario: Reveal locates the action

- **GIVEN** action A is tracked
- **WHEN** the user activates « Voir dans la liste »
- **THEN** A is scrolled into view and receives visible focus or a visible
  highlight

#### Scenario: Reveal works with completed actions hidden

- **GIVEN** « Masquer les étapes terminées » is enabled
- **WHEN** the user activates « Voir dans la liste » for an unfinished tracked
  action
- **THEN** the action is visible and identifiable because unfinished actions stay
  rendered

#### Scenario: Reveal works on mobile

- **GIVEN** a mobile viewport
- **WHEN** the user activates « Voir dans la liste »
- **THEN** the tracked action becomes visible and identifiable

### Requirement: Clear tracking

WHEN the user activates « Ne plus suivre », the app SHALL remove the tracked
reference and hide the card without completing, editing or removing the action
and without changing the stored document.

#### Scenario: Clearing removes the reference only

- **GIVEN** action A is tracked
- **WHEN** the user activates « Ne plus suivre »
- **THEN** no card is shown and A is still present, unfinished and unchanged

#### Scenario: Cleared tracking does not return

- **GIVEN** the user cleared tracking
- **WHEN** the page is reloaded
- **THEN** no card is shown and no preference remains

### Requirement: Automatic cleanup

WHEN the tracked action is completed or removed, or its subject is removed, the
app SHALL clear the stored reference and hide the card, leaving no orphan
reference and producing no error.

#### Scenario: Completing the tracked action clears tracking

- **GIVEN** action A is tracked as unfinished
- **WHEN** A is marked done
- **THEN** the reference is cleared and no card is shown

#### Scenario: Removing the tracked action clears tracking

- **GIVEN** action A is tracked
- **WHEN** A is removed from its subject
- **THEN** the reference is cleared, no card is shown and no error occurs

#### Scenario: Removing the tracked action's subject clears tracking

- **GIVEN** action A in subject S is tracked
- **WHEN** subject S is removed
- **THEN** the reference is cleared and no card is shown

### Requirement: JSON export/import compatibility

Tracking MUST NOT change the document JSON shape, its version or the
`threadstep.document.v1` storage key. Exports produced before this change MUST
remain importable. The tracking preference MUST NOT be included in exports, and
importing a document that does not contain the tracked action SHALL clear the
reference.

#### Scenario: Older export stays importable

- **GIVEN** a JSON export produced before this change
- **WHEN** it is imported
- **THEN** it is accepted and the application keeps the `threadstep.document.v1`
  shape and version

#### Scenario: Exported JSON has no tracking data

- **GIVEN** an action is tracked
- **WHEN** the user exports the document
- **THEN** the exported JSON contains no tracking field and equals the document
  structure without the preference

#### Scenario: Import without the tracked action clears it

- **GIVEN** action A is tracked
- **WHEN** a valid document that does not contain A is imported
- **THEN** the reference is cleared and no card is shown

#### Scenario: Preference lives outside the document

- **GIVEN** an action is tracked
- **WHEN** the browser storage is inspected
- **THEN** the reference is stored under a key separate from
  `threadstep.document.v1`

### Requirement: Independence from the suggestion

Requesting the « Une étape pour maintenant » suggestion MUST NOT change the
tracked action, and defining or clearing the tracked action MUST NOT change the
suggestion.

#### Scenario: Suggestion does not alter tracking

- **GIVEN** action A is tracked
- **WHEN** the user requests the suggestion
- **THEN** A remains tracked and the card is unchanged

#### Scenario: Tracking does not alter the suggestion

- **GIVEN** the document is unchanged
- **WHEN** the user defines or clears a tracked action
- **THEN** the suggestion computed on the next request reflects only the current
  document state

### Requirement: Accessible controls and safe text

All resume controls SHALL be keyboard-accessible, use French names, announce the
tracked state and be usable at a mobile viewport. User-provided subject names
and action titles MUST be rendered as text nodes and MUST NOT be interpreted as
HTML.

#### Scenario: Keyboard-only operation

- **GIVEN** a keyboard-only user
- **WHEN** they define, reveal and clear the tracked action
- **THEN** every step is possible without a pointer and focus stays on a
  sensible control

#### Scenario: Tracked state is announced

- **GIVEN** action A is tracked
- **WHEN** the list and card are rendered
- **THEN** the tracked state is conveyed in French text and is available to
  assistive technology

#### Scenario: Mobile usage

- **GIVEN** a mobile viewport
- **WHEN** the card and controls are displayed
- **THEN** they are readable and operable without horizontal scrolling

#### Scenario: Markup shown literally

- **WHEN** a subject name or action title contains markup such as
  `<img src=x onerror=alert(1)>`
- **THEN** the text is displayed literally and no element is created from it
