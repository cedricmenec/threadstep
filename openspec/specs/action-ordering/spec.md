# action-ordering Specification

## Purpose
Lets the user rank top-level actions manually inside each priority group through
a drag handle or accessible move controls, while urgent → normal → later
grouping, hierarchy and stored data stay untouched.

## Requirements

### Requirement: Drag handle on top-level actions

Every top-level action SHALL render a visible French drag handle with an
accessible name naming the action and its priority, used to rank it among the
top-level actions of one priority in its subject. The handle MUST be at least
44 × 44 px and MUST begin a pointer drag without triggering editing, removal,
tracking or completion. A one-level substep MUST NOT render a top-level handle;
substep ordering is owned by its own capability.

#### Scenario: Top-level action shows a handle

- **WHEN** a subject displays a top-level action
- **THEN** that action shows a visible drag handle with an accessible French name

#### Scenario: Substeps have no handle

- **WHEN** a subject displays a one-level substep
- **THEN** no top-level drag handle is rendered on that substep

#### Scenario: Handle name includes action and priority

- **WHEN** a handle is rendered for an action
- **THEN** its accessible name contains the action title and its priority

#### Scenario: Handle does not trigger other controls

- **GIVEN** a top-level action is displayed
- **WHEN** the user activates « Modifier », « Retirer », « Garder le fil » or the
  completion checkbox
- **THEN** no drag starts and the action is not moved

### Requirement: Same-subject and same-priority scope

A reorder SHALL move a top-level action only within its own subject and only
among top-level actions sharing its priority. It MUST NOT change any action's
priority or the order of actions of other priorities. A drop on another subject,
another priority, a substep, empty space or any other target MUST be refused with
no document mutation and no storage write.

#### Scenario: Move a normal action before another normal action

- **GIVEN** a subject contains B (normal) then C (normal)
- **WHEN** C is dropped before B
- **THEN** the displayed order becomes C then B within the normal group

#### Scenario: Drop on a different priority is refused

- **GIVEN** a subject contains an urgent action and a normal action
- **WHEN** the normal action is dropped on the urgent action
- **THEN** no action moves and the document is unchanged

#### Scenario: Drop on another subject is refused

- **GIVEN** two subjects each contain a top-level normal action
- **WHEN** an action from the first subject is dropped on the second subject
- **THEN** no action moves and both subjects are unchanged

#### Scenario: Drop on a substep is refused

- **GIVEN** a top-level action has a substep
- **WHEN** another top-level action is dropped on that substep
- **THEN** no action moves and no `parentId` changes

#### Scenario: Drop on empty space is refused

- **GIVEN** a subject contains several top-level actions
- **WHEN** a dragged action is released outside any valid target
- **THEN** the order is unchanged and nothing is saved

### Requirement: Priority presentation order preserved

Presentation SHALL stay urgent, then normal, then later, with the manually
chosen order shown inside each priority. Reordering MUST NOT change the relative
position or data of actions of other priorities, of substeps, or of other
subjects.

#### Scenario: Mixed priorities keep their grouping

- **GIVEN** a subject contains A (urgent), B (normal), C (normal) and D (later)
- **WHEN** C is moved before B
- **THEN** the display becomes A, C, B, D with unchanged priorities

#### Scenario: Interleaved source array reorders within its group only

- **GIVEN** the underlying item array interleaves several priorities
- **WHEN** two actions of one priority are reordered
- **THEN** only that priority's relative order changes and the other groups keep
  their order

#### Scenario: Substeps and other subjects untouched

- **WHEN** a top-level action is reordered
- **THEN** every substep and every other subject keeps its data and order

### Requirement: Order stored without a schema change

The new sequence SHALL be stored in the existing `subject.items` array; no
position field, document version or storage key SHALL change. The order MUST
survive a reload and a JSON export/import round-trip.

#### Scenario: No new field or version change

- **WHEN** a reorder is persisted
- **THEN** the document keeps version 1, the `threadstep.document.v1` key and
  items containing no new field

#### Scenario: Reload retains the order

- **WHEN** an action is reordered and the page is reloaded
- **THEN** the stored manual order is restored

#### Scenario: Export and import round-trip

- **WHEN** a reordered document is exported and re-imported
- **THEN** the order, ids, priorities, flags and parents are preserved

### Requirement: Parent carries its substeps

Moving a top-level action SHALL keep its substeps attached. Their `parentId`,
ids, titles, priorities, completion flags and mutual order MUST be unchanged by a
top-level reorder, and a top-level reorder MUST NOT move, reorder or re-parent
any substep.

#### Scenario: Parent move keeps its children

- **GIVEN** a top-level action has substeps
- **WHEN** the parent is reordered
- **THEN** every substep stays attached with unchanged `parentId`, data and order

#### Scenario: Substeps are not reorder targets

- **GIVEN** a top-level action has substeps
- **WHEN** a top-level action is dragged or moved with the move controls
- **THEN** no substep becomes a top-level reorder target and every substep stays
  attached with unchanged data and order

### Requirement: Accessible move controls

Every top-level action SHALL expose, through its per-item actions menu,
keyboard- and touch-operable French « Monter » and « Descendre » controls that
move it exactly one rank inside its priority group, with accessible names naming
the action and its priority, disabled at the group boundaries, never changing
priority, and announcing success. The drag handle SHALL stay directly visible on
the row.

#### Scenario: Move one rank inside the group

- **GIVEN** a priority group with several top-level actions
- **WHEN** the user activates « Monter » or « Descendre » on a member
- **THEN** it swaps with its immediate neighbour in that priority group only

#### Scenario: Boundaries disable the controls

- **GIVEN** an action is first or last in its priority group
- **WHEN** the list is rendered
- **THEN** the impossible move control is disabled

#### Scenario: Same result as an adjacent drop

- **WHEN** a move control is activated
- **THEN** the resulting order equals an adjacent drag-and-drop of the same rank

#### Scenario: Keyboard operation announces success

- **GIVEN** a keyboard-only user
- **WHEN** a move control is activated
- **THEN** the move succeeds, a message announces it, and focus remains usable

### Requirement: Single save and cancellation

A reorder SHALL save at most once, when the gesture is accepted. Escape,
`pointercancel`, an invalid target or an interrupted gesture MUST leave the
document unchanged and MUST NOT save.

#### Scenario: Valid drag saves once

- **WHEN** a valid drag-and-drop is completed
- **THEN** exactly one storage write occurs at the end of the gesture

#### Scenario: Escape cancels

- **GIVEN** a drag is in progress
- **WHEN** the user presses Escape
- **THEN** no action moves and nothing is saved

#### Scenario: Pointer cancellation cancels

- **GIVEN** a drag is in progress
- **WHEN** the browser emits `pointercancel`
- **THEN** no action moves and nothing is saved

#### Scenario: Invalid target saves nothing

- **GIVEN** a drag is in progress over an invalid target
- **WHEN** the pointer is released
- **THEN** the document and storage are unchanged

### Requirement: Suspension under the completed filter

While « Masquer les étapes terminées » is enabled, reordering controls SHALL be
unavailable and a short French explanation SHALL say that all steps must be shown
to reorganise. Re-displaying steps MUST restore the controls without changing the
stored order.

#### Scenario: Filter disables reordering

- **GIVEN** « Masquer les étapes terminées » is enabled
- **WHEN** the list is rendered
- **THEN** no handle is offered, the move controls are disabled, and a French
  explanation states that all steps must be shown to reorganise

#### Scenario: Re-displaying steps restores controls

- **WHEN** the filter is turned off
- **THEN** reordering controls become available again

#### Scenario: Toggle never changes stored order

- **WHEN** the filter is enabled and disabled repeatedly
- **THEN** the stored order is unchanged and filtering behaves as before

### Requirement: Coherence with existing behavior

After a reorder the unfinished counter, the TS-007 suggestion, the TS-008
tracking and the TS-010 undo SHALL stay coherent: the suggestion SHALL follow the
new within-subject item order for equal priorities, tracking SHALL keep using
stable ids, and no id, priority or completion flag SHALL change.

#### Scenario: Suggestion follows the new order

- **GIVEN** one subject has two unfinished top-level actions of the same priority
- **WHEN** their order is changed and the suggestion is activated
- **THEN** the earlier action in the new order is suggested

#### Scenario: Tracking uses stable ids

- **GIVEN** an action is tracked as « Je reprends ici »
- **WHEN** it is reordered
- **THEN** it remains tracked and its card is unchanged

#### Scenario: Removal undo restores the recorded position

- **GIVEN** an action was reordered and then removed
- **WHEN** the removal is undone within its window
- **THEN** it returns to the position it had when removed

#### Scenario: No identity change

- **WHEN** a reorder is persisted
- **THEN** every id, priority, completion flag and `parentId` is unchanged

### Requirement: Accessible, mobile and safe text

Controls and labels SHALL remain French with accessible names including the
action and its priority. Reordering SHALL work with mouse, touch and stylus on a
narrow viewport, page scroll SHALL stay natural outside the handle, any animation
SHALL respect `prefers-reduced-motion`, and titles SHALL render as text nodes.

#### Scenario: Touch operation on a narrow viewport

- **GIVEN** a narrow touch viewport
- **WHEN** the user drags a handle or uses a move control
- **THEN** the action is reordered and the drop hint stays readable

#### Scenario: Scrolling outside the handle

- **GIVEN** a touch device
- **WHEN** the user swipes vertically outside a handle
- **THEN** the page scrolls normally

#### Scenario: Reduced motion honored

- **GIVEN** `prefers-reduced-motion` is enabled
- **WHEN** a drag starts, moves or ends
- **THEN** no non-essential animation is played

#### Scenario: Markup shown literally

- **WHEN** a title contains markup such as `<img src=x onerror=alert(1)>`
- **THEN** it is displayed literally and creates no element
