# substep-ordering Specification

## Purpose

Lets the user rank the one-level substeps of one parent action manually inside
each priority group through a drag handle or accessible move controls, while
hierarchy, priorities and stored data stay untouched.

## Requirements

### Requirement: Handle and move controls on one-level substeps

Every one-level substep SHALL render a visible French drag handle on its row and
SHALL expose accessible « Monter » / « Descendre » commands through its per-item
actions menu. The handle MUST be at least 44 × 44 px and MUST begin a pointer
drag without triggering editing, removal or completion. Controls MUST NOT be
offered on an item without a parent. A handle MUST move its substep only inside
its own parent and priority group.

#### Scenario: Substeps show a handle

- **WHEN** a parent action displays its one-level substeps
- **THEN** each displayed substep shows a visible drag handle with a French
  accessible name

#### Scenario: Handle name includes substep and priority

- **WHEN** a handle is rendered for a substep
- **THEN** its accessible name contains the substep title, its priority and an
  indication that it belongs to its parent action

#### Scenario: Top-level actions keep their own controls

- **WHEN** a top-level action is rendered
- **THEN** it shows the top-level handle and offers the top-level move commands
  through its menu, not the substep controls

#### Scenario: Handle does not trigger other controls

- **GIVEN** a substep is displayed
- **WHEN** the user activates « Modifier », « Retirer » or the completion checkbox
- **THEN** no drag starts and the substep is not moved

### Requirement: Same-parent and same-priority scope

A substep reorder SHALL move a substep only within its own parent action and only
among direct substeps sharing its priority. It MUST NOT change any `parentId`,
priority, or the order of other priorities, parents or subjects. A drop on
another parent, another subject, another priority, a top-level action, empty space
or any invalid target MUST be refused with no document mutation and no storage
write.

#### Scenario: Move a normal substep before another normal substep

- **GIVEN** parent P has substeps a, b, c of priority `normal`
- **WHEN** c is dropped before a
- **THEN** the displayed order becomes c, a, b within the normal group

#### Scenario: Drop on another parent is refused

- **GIVEN** parents P1 and P2 each have a `normal` substep
- **WHEN** a substep of P1 is dropped on a substep of P2
- **THEN** neither substep moves and both parents are unchanged

#### Scenario: Drop on another priority is refused

- **GIVEN** a parent has substeps of priority `urgent` and `normal`
- **WHEN** the normal substep is dropped on the urgent substep
- **THEN** no substep moves and the document is unchanged

#### Scenario: Drop on a top-level action is refused

- **GIVEN** a subject has a top-level action and a parent action with a substep
- **WHEN** the substep is dropped on the top-level action
- **THEN** no substep moves and no `parentId` changes

#### Scenario: Drop on empty space is refused

- **GIVEN** a parent has several substeps
- **WHEN** a dragged substep is released outside any sibling target
- **THEN** the order is unchanged and nothing is saved

#### Scenario: Unchanged position is refused

- **GIVEN** a parent has substeps a, b, c of the same priority
- **WHEN** b is dropped at its own position
- **THEN** the order is unchanged and nothing is saved

### Requirement: Priority presentation order preserved

Inside one parent, presentation SHALL stay urgent, then normal, then later, with
the manually chosen order shown inside each priority. A substep reorder MUST NOT
change the relative position or data of substeps of other priorities, of other
parents, of top-level actions or of other subjects.

#### Scenario: Mixed priorities keep their grouping

- **GIVEN** a parent has a, b, c, d with a urgent and b, c, d normal
- **WHEN** c is moved before b
- **THEN** the display becomes a, c, b, d with unchanged priorities

#### Scenario: Interleaved source array reorders within its group only

- **GIVEN** the underlying item array interleaves substeps of several priorities
- **WHEN** two substeps of one priority and one parent are reordered
- **THEN** only that group's relative order changes and the other groups keep
  their order

#### Scenario: Other parents and top-level actions untouched

- **WHEN** a substep is reordered
- **THEN** every other parent, every other substep and every top-level action
  keeps its data and order

### Requirement: Order stored without a schema change

The new substep sequence SHALL be stored in the existing `subject.items` array;
no position field, document version or storage key SHALL change. The order MUST
survive a reload and a JSON export/import round-trip.

#### Scenario: No new field or version change

- **WHEN** a substep reorder is persisted
- **THEN** the document keeps version 1, the `threadstep.document.v1` key and
  items containing no new field

#### Scenario: Reload retains the order

- **WHEN** a substep is reordered and the page is reloaded
- **THEN** the stored manual order is restored

#### Scenario: Export and import round-trip

- **WHEN** a document with reordered substeps is exported and re-imported
- **THEN** the order, ids, priorities, flags and parents are preserved

### Requirement: No re-parenting or level change

Reordering a substep MUST NOT change its `parentId`, MUST NOT move it to another
parent or subject, MUST NOT change its priority, and MUST NOT turn it into a
top-level action. A top-level action MUST NOT become a substep. The only
sanctioned level change is the explicit « Promouvoir en tâche principale »
operation owned by the `substep-promotion` capability; a reorder never performs
it.

#### Scenario: Parent stays the same

- **GIVEN** a substep belongs to parent P
- **WHEN** the substep is reordered
- **THEN** its `parentId` is still P and no other item's `parentId` changes

#### Scenario: Level stays the same

- **GIVEN** a top-level action and a substep
- **WHEN** any reorder is attempted between them
- **THEN** neither changes level and no item becomes a substep or a top-level
  action

#### Scenario: Priority is never changed by a move

- **WHEN** a substep is reordered
- **THEN** its priority and every other item's priority are unchanged

#### Scenario: Promotion is not a reorder

- **GIVEN** a one-level substep
- **WHEN** any supported reorder gesture or move control is used
- **THEN** it stays a substep with an unchanged `parentId`, and only the
  explicit « Promouvoir en tâche principale » command can change its level

### Requirement: Top-level ordering unchanged

The existing top-level reordering SHALL keep working identically: a top-level
action still reorders only among top-level actions of one priority in its
subject, and no substep ordering path changes the top-level order, its controls
or its accessible names.

#### Scenario: Top-level drag and controls are identical

- **GIVEN** a subject with several top-level actions
- **WHEN** a top-level action is dragged or moved with « Monter » / « Descendre »
- **THEN** the resulting order equals the pre-change top-level behavior and no
  substep becomes a top-level target

#### Scenario: Substeps do not change the top-level order

- **WHEN** a substep is reordered
- **THEN** the top-level order of its subject and of every other subject is
  unchanged

### Requirement: Accessible move controls

Every substep SHALL expose, through its per-item actions menu, keyboard- and
touch-operable French « Monter » and « Descendre » controls that move it exactly
one rank inside its parent and priority group, with accessible names naming the
substep, its priority and its parent, disabled at the group boundaries, never
changing priority, and announcing success.

#### Scenario: Move one rank inside the group

- **GIVEN** a parent+priority group with several substeps
- **WHEN** the user activates « Monter » or « Descendre » on a member
- **THEN** it swaps with its immediate neighbour in that group only

#### Scenario: Boundaries disable the controls

- **GIVEN** a substep is first or last in its parent+priority group
- **WHEN** the list is rendered
- **THEN** the impossible move control is disabled

#### Scenario: Same result as an adjacent drop

- **WHEN** a move control is activated
- **THEN** the resulting order equals an adjacent drag-and-drop of the same rank

#### Scenario: Keyboard operation announces success

- **GIVEN** a keyboard-only user
- **WHEN** a substep move control is activated
- **THEN** the move succeeds, a French message announces it, and focus remains
  usable

### Requirement: Single save and cancellation

A substep reorder SHALL save at most once, when the gesture is accepted. Escape,
`pointercancel`, a lost pointer capture, an invalid target or an interrupted
gesture MUST leave the document unchanged and MUST NOT save.

#### Scenario: Valid drag saves once

- **WHEN** a valid substep drag-and-drop is completed
- **THEN** exactly one storage write occurs at the end of the gesture

#### Scenario: Escape cancels

- **GIVEN** a substep drag is in progress
- **WHEN** the user presses Escape
- **THEN** no substep moves and nothing is saved

#### Scenario: Pointer cancellation cancels

- **GIVEN** a substep drag is in progress
- **WHEN** the browser emits `pointercancel` or the pointer capture is lost
- **THEN** no substep moves and nothing is saved

#### Scenario: Invalid target saves nothing

- **GIVEN** a substep drag is in progress over an invalid target
- **WHEN** the pointer is released
- **THEN** the document and storage are unchanged

### Requirement: Suspension under the completed filter

While « Masquer les étapes terminées » is enabled, substep reordering controls
SHALL be unavailable and the existing short French explanation SHALL say that all
steps must be shown to reorganise. Re-displaying steps MUST restore the controls
without changing the stored order.

#### Scenario: Filter disables substep reordering

- **GIVEN** « Masquer les étapes terminées » is enabled
- **WHEN** the list is rendered
- **THEN** no substep handle is offered, the substep move controls are disabled
  and the French explanation states that all steps must be shown to reorganise

#### Scenario: Re-displaying steps restores controls

- **WHEN** the filter is turned off
- **THEN** the substep reordering controls become available again

#### Scenario: Toggle never changes stored order

- **WHEN** the filter is enabled and disabled repeatedly
- **THEN** the stored substep order is unchanged

### Requirement: Collapsed parents

The substeps of a collapsed parent action are not rendered, so they MUST NOT
expose a handle or move control and MUST NOT accept a drop. Expanding SHALL
restore them in the same stored order and states, and a collapsed parent MUST
never be modified by an invisible substep move.

#### Scenario: Collapsed parent exposes no substep controls

- **GIVEN** a parent with substeps is collapsed
- **WHEN** the list is rendered
- **THEN** no substep handle or move control exists for that parent

#### Scenario: Expanding restores the same order

- **GIVEN** a collapsed parent whose substeps have a stored order
- **WHEN** the parent is expanded
- **THEN** the substeps appear in that same stored order with unchanged states

#### Scenario: No invisible move is possible

- **GIVEN** a parent is collapsed
- **WHEN** any item is dragged around the parent
- **THEN** the collapsed parent's substeps do not move and nothing is saved

### Requirement: Coherence with existing behavior

After a substep reorder the pending counter, the deterministic suggestion, the
« Je reprends ici » tracking, the removal undo and the TS-012/TS-013 collapse
control and labels SHALL stay coherent. No id, title, priority, `done` flag or
`parentId` SHALL change, and tracking SHALL keep using stable ids.

#### Scenario: Counter and suggestion unchanged

- **GIVEN** a document with a suggested action and a pending count
- **WHEN** a substep is reordered
- **THEN** the pending count and the deterministic suggestion are unchanged

#### Scenario: Tracking unchanged

- **GIVEN** a top-level action is tracked as « Je reprends ici »
- **WHEN** a substep is reordered
- **THEN** the tracked action and its card are unchanged

#### Scenario: Removal undo restores the recorded position

- **GIVEN** a substep was reordered and then removed
- **WHEN** the removal is undone within its window
- **THEN** it returns to the position it had when removed

#### Scenario: Collapse control and labels unchanged

- **WHEN** a substep is reordered
- **THEN** the TS-012/TS-013 disclosure control, its label and its
  `aria-expanded` are unchanged

#### Scenario: No identity change

- **WHEN** a substep reorder is persisted
- **THEN** every id, title, priority, `done` flag and `parentId` is unchanged

### Requirement: Accessible, mobile and safe text

Controls and labels SHALL remain French with accessible names naming the substep,
its priority and its parent. Reordering SHALL work with mouse, touch and stylus on
a narrow viewport, page scroll SHALL stay natural outside the handle, any
animation SHALL respect `prefers-reduced-motion`, and titles SHALL render as text
nodes.

#### Scenario: Touch operation on a narrow viewport

- **GIVEN** a narrow touch viewport
- **WHEN** the user drags a substep handle or uses a substep move control
- **THEN** the substep is reordered and the drop hint stays readable

#### Scenario: Scrolling outside the handle

- **GIVEN** a touch device
- **WHEN** the user swipes vertically outside a substep handle
- **THEN** the page scrolls normally

#### Scenario: Reduced motion honored

- **GIVEN** `prefers-reduced-motion` is enabled
- **WHEN** a substep drag starts, moves or ends
- **THEN** no non-essential animation is played

#### Scenario: Markup shown literally

- **WHEN** a substep title contains markup such as
  `<img src=x onerror=alert(1)>`
- **THEN** it is displayed literally and creates no element
