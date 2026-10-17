# next-action-suggestion Specification

## Purpose
Suggests, deterministically and without persisting anything, one unfinished
top-level action to work on next and gives the user an accessible way to locate
it in the list.

## Requirements

### Requirement: Suggestion control

The app SHALL display a visible French « Une étape pour maintenant » control
near the global unfinished counter. The control MUST be operable by keyboard and
by touch and MUST expose an accessible name.

#### Scenario: Control is present

- **WHEN** the dashboard is displayed
- **THEN** a « Une étape pour maintenant » control appears near the unfinished
  counter

#### Scenario: Keyboard activation

- **WHEN** a keyboard user focuses and activates the control
- **THEN** the suggestion is computed and shown without using a pointer

#### Scenario: Touch activation

- **WHEN** the control is tapped on a touch device
- **THEN** the suggestion is computed and shown

### Requirement: Eligible candidates

Only unfinished top-level actions SHALL be eligible. Completed actions, all
substeps, and completed parents with unfinished children MUST be excluded.

#### Scenario: Completed action excluded

- **WHEN** a top-level action is done
- **THEN** it is never suggested

#### Scenario: Substeps excluded

- **WHEN** a parent action has unfinished substeps
- **THEN** those substeps are not independently suggested

#### Scenario: Completed parent with unfinished child excluded

- **WHEN** a completed top-level action still has an unfinished substep
- **THEN** that completed parent is not suggested

### Requirement: Deterministic selection order

The suggestion SHALL be the eligible action with the highest priority in the
order urgent, normal, later. Ties MUST be broken by earlier subject order, then
earlier underlying item order. Selection MUST be deterministic and MUST NOT use
randomness, dates, network requests or AI.

#### Scenario: Urgent wins across subjects

- **WHEN** unfinished urgent, normal and later top-level actions exist across
  several subjects
- **THEN** the first urgent action in subject order is suggested

#### Scenario: Priority dominates subject order

- **WHEN** an earlier subject has only normal actions and a later subject has an
  urgent action
- **THEN** the urgent action is suggested

#### Scenario: Subject order breaks a priority tie

- **WHEN** two subjects both contain an unfinished action of the same priority
- **THEN** the action from the earlier subject is suggested

#### Scenario: Item order breaks a within-subject tie

- **WHEN** one subject has two unfinished top-level actions of the same priority
- **THEN** the earlier one in the underlying item order is suggested

#### Scenario: Repeated activation is stable

- **WHEN** the document is unchanged and the control is activated several times
- **THEN** the same action is suggested each time

### Requirement: Empty state

WHEN no eligible top-level action exists, the app SHALL show a friendly French
message instead of a focus card.

#### Scenario: No unfinished action

- **WHEN** every top-level action is completed
- **THEN** a friendly French empty-state message is shown and no card is shown

#### Scenario: Only substeps remain

- **WHEN** the only unfinished actions are substeps
- **THEN** the empty-state message is shown

### Requirement: Suggestion card content

WHEN an eligible action exists, the app SHALL show exactly one compact,
non-modal card with that action's subject name, action title and priority, plus
a short French explanation of why that action was selected. The explanation MUST
name the effective priority and MUST state the existing tie-break order of
earlier subject order then earlier action order. It MUST NOT change the
selection or introduce any criterion beyond that order.

#### Scenario: Card shows the suggested action

- **WHEN** an eligible action is suggested
- **THEN** the card shows its subject name, its title and its priority and no
  second action

#### Scenario: Explanation names the effective priority

- **GIVEN** an eligible suggested action whose priority is urgent, normal or
  later
- **WHEN** the card is shown
- **THEN** the explanation names that same priority in French

#### Scenario: Explanation states the tie-break order

- **WHEN** the card is shown
- **THEN** the explanation states that, for equal priority, earlier subject order
  then earlier action order decides, and names no other criterion

#### Scenario: No explanation without a suggestion

- **WHEN** no eligible action exists
- **THEN** no explanation and no suggestion card are shown

### Requirement: Locate the suggested action

WHEN the user activates « Voir dans la liste », the suggested action SHALL be
brought into view and receive keyboard-accessible focus or a visible highlight,
including on mobile.

#### Scenario: Reveal focuses the action

- **WHEN** the user activates « Voir dans la liste »
- **THEN** the action is scrolled into view and receives visible focus or a
  visible highlight

#### Scenario: Reveal works on mobile

- **WHEN** « Voir dans la liste » is activated at a mobile viewport
- **THEN** the action becomes visible and identifiable

### Requirement: View-only and non-persistent

The suggestion MUST NOT modify the stored document or exported JSON. It MUST NOT
change any id, done flag, priority, item order or subject order, MUST be
recomputed from current state on each activation, and MUST NOT persist across a
reload.

#### Scenario: No storage write

- **WHEN** the control is activated and « Voir dans la liste » is used
- **THEN** localStorage, exported JSON, ids, done flags, priorities and both
  orders are unchanged

#### Scenario: Recompute after document changes

- **WHEN** a user completes an action, changes a priority or reorders subjects
  and activates the control again
- **THEN** the new suggestion reflects the current state

#### Scenario: Not persisted across reload

- **WHEN** the page is reloaded after a suggestion was shown
- **THEN** no suggestion card is restored automatically

### Requirement: Safe text rendering

The subject name and action title shown in the card SHALL be rendered as text
nodes. User-provided text MUST NOT be interpreted as HTML.

#### Scenario: Markup shown literally

- **WHEN** a suggested title contains markup such as `<img src=x onerror=alert(1)>`
- **THEN** the text is displayed literally and no element is created from it

### Requirement: Locate a suggested action beyond the overview preview

WHEN the suggested action is not among the five visible top-level tasks previewed
on its overview card, activating « Voir dans la liste » SHALL open the detail view
of that action's subject and reveal the action there. It MUST NOT attempt to
target, scroll to or focus an element that is absent from the overview, and it
MUST NOT modify the stored document, ids, priorities or ordering.

#### Scenario: Suggested action beyond the preview

- **WHEN** the suggested action is not among the five previewed entries
- **THEN** the detail view of its subject opens and the action is revealed

#### Scenario: Suggested action within the preview

- **WHEN** the suggested action is among the five previewed entries
- **THEN** it is revealed in the overview as before

#### Scenario: No command targets an absent element

- **WHEN** the suggested action is beyond the preview
- **THEN** no scroll or focus targets an element that is not in the overview DOM

#### Scenario: Reveal stays view-only

- **WHEN** the reveal is used for a suggestion beyond the preview
- **THEN** the document, localStorage and the exported JSON are unchanged
