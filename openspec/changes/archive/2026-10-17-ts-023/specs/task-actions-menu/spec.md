# Spec Delta

## Purpose

Lets the user scan a denser task list by grouping the secondary commands of each
task or substep behind a single accessible per-item actions menu, while the
primary controls stay directly visible and every existing validation,
restriction, persistence and undo behavior is preserved.

## ADDED Requirements

### Requirement: Per-item actions menu control

Each rendered top-level task and direct substep SHALL expose a native `button`
of `type="button"` with the accessible name « Actions pour <titre> » and a touch
target of at least 44 × 44 px, whose `aria-expanded` exactly reflects whether
its menu is open.

#### Scenario: Top-level task shows the menu button

- **WHEN** a subject displays a top-level task
- **THEN** that task shows a native « ⋮ » menu button

#### Scenario: Direct substep shows the menu button

- **WHEN** a parent displays a direct substep
- **THEN** that substep shows the same native menu button

#### Scenario: Accessible name names the item

- **WHEN** a menu button is rendered for an item
- **THEN** its accessible name contains « Actions pour » and the item title as text

#### Scenario: Touch target large enough

- **WHEN** a menu button is rendered
- **THEN** its touch target is at least 44 × 44 px

#### Scenario: aria-expanded is exact

- **WHEN** the menu is closed
- **THEN** the button exposes `aria-expanded="false"`, and `"true"` while the menu is open

### Requirement: Menu opens and closes with mouse, touch and keyboard

The menu button SHALL open and close the menu with a mouse click, a touch and
the Enter or Space key, and Escape SHALL close an open menu. Focus navigation
with Tab inside an open menu SHALL be predictable and stay inside the menu
panel.

#### Scenario: Mouse and touch toggle

- **WHEN** the button is clicked or tapped
- **THEN** the menu opens, and a second click or tap closes it

#### Scenario: Keyboard toggle

- **GIVEN** keyboard focus is on the menu button
- **WHEN** the user presses Enter or Space
- **THEN** the menu opens, and a second press closes it

#### Scenario: Escape closes

- **GIVEN** the menu is open
- **WHEN** the user presses Escape
- **THEN** the menu closes

#### Scenario: Tab order is predictable

- **GIVEN** the menu is open
- **WHEN** the user presses Tab
- **THEN** focus moves through the menu's commands in their visible order

### Requirement: Applicable commands grouped per item

The open menu SHALL offer exactly the commands applicable to the item, and a
non-applicable command MUST be absent or disabled with a clear indication. No
command offered in the menu is duplicated elsewhere on the row.

#### Scenario: Top-level task commands

- **WHEN** the menu of a top-level task is open
- **THEN** it offers « Modifier », « Retirer », « Ajouter une sous-tâche » and, when unfinished, « Garder le fil », without any promotion command

#### Scenario: Direct substep commands

- **WHEN** the menu of a direct substep is open
- **THEN** it offers « Modifier », « Retirer » and « Promouvoir en tâche principale », without « Ajouter une sous-tâche » or « Garder le fil »

#### Scenario: Tracked parent shows its state

- **GIVEN** a top-level task is already tracked as « Je reprends ici »
- **WHEN** its menu is open
- **THEN** the tracked state is shown and no second « Garder le fil » action is offered

#### Scenario: No command is duplicated on the row

- **WHEN** a task or substep is rendered
- **THEN** the commands grouped in the menu are not also rendered as inline row controls

### Requirement: Move controls keep a keyboard alternative in the menu

The « Monter » and « Descendre » commands SHALL leave the visible row and SHALL
remain available in the menu with the same same-subject, same-parent and
same-priority restrictions and the same disabled boundaries; no drag gesture is
required. The drag handle SHALL stay directly visible when reordering is
allowed.

#### Scenario: Move commands are no longer on the row

- **WHEN** a task or substep is rendered
- **THEN** no inline « Monter » or « Descendre » button appears on the row

#### Scenario: Move commands are in the menu

- **WHEN** the menu of a task or substep is open
- **THEN** « Monter » and « Descendre » are offered

#### Scenario: Same restrictions and result as before

- **GIVEN** a priority group with several items
- **WHEN** « Monter » or « Descendre » is activated from the menu
- **THEN** the item moves one rank inside its allowed group, exactly as the previous inline control did

#### Scenario: Boundaries disable the commands

- **GIVEN** an item is first or last in its allowed group
- **WHEN** its menu is open
- **THEN** the impossible move command is disabled with a clear indication

#### Scenario: Drag handle stays visible

- **GIVEN** reordering is allowed
- **WHEN** a task or substep is rendered
- **THEN** its drag handle remains directly visible and operable

#### Scenario: Project reorder arrows are untouched

- **WHEN** a subject card is rendered
- **THEN** its « Monter » / « Descendre » project arrows stay directly visible and behave as before

#### Scenario: Suspended under the completed filter

- **GIVEN** « Masquer les étapes terminées » is enabled
- **WHEN** the list is rendered
- **THEN** no drag handle is offered and the menu move commands are disabled

### Requirement: Primary controls remain directly visible

The completion checkbox, the title, the interactive priority control, the drag
handle when sorting is allowed, the disclosure control and the menu button SHALL
remain directly visible and usable on the row, outside the menu, and the
priority control MUST NOT open the menu or start a drag.

#### Scenario: Primary controls visible with the menu closed

- **WHEN** a task or substep is rendered with its menu closed
- **THEN** its completion checkbox, title, priority control, disclosure control and menu button are present

#### Scenario: Priority control is independent

- **WHEN** the user activates the priority control
- **THEN** no menu opens, no drag starts and no other command runs

#### Scenario: Priority control keeps its values and target

- **WHEN** the priority control is rendered in a compact row
- **THEN** it still offers Urgent, Normal and Plus tard and keeps an interactive area of at least 44 × 44 px

### Requirement: Single menu, closing and focus return

At most one menu SHALL be open at a time. An outside click, a change of view and
activating a command SHALL close the open menu. After a close with no other focus
target, keyboard focus SHALL return to the menu button of the same item.

#### Scenario: Only one menu is open

- **GIVEN** one item's menu is open
- **WHEN** the user opens another item's menu
- **THEN** the first menu closes and only the second stays open

#### Scenario: Outside click closes

- **GIVEN** a menu is open
- **WHEN** the user clicks or taps outside the menu
- **THEN** the menu closes

#### Scenario: View change closes

- **GIVEN** a menu is open
- **WHEN** the user opens the detail view, returns to the overview or opens another project
- **THEN** the menu closes

#### Scenario: Activating a command closes

- **GIVEN** a menu is open
- **WHEN** the user activates one of its commands
- **THEN** the menu closes and the command's own behavior runs

#### Scenario: Focus returns to the button

- **GIVEN** a menu was open
- **WHEN** it closes without another focus target
- **THEN** keyboard focus returns to that item's menu button

### Requirement: Opening and closing write nothing and start no drag

Opening or closing the menu SHALL NOT write localStorage, mutate the document,
create a storage key or start a drag; the open state is presentation-only.

#### Scenario: No write on open or close

- **WHEN** the menu is opened and closed without activating a command
- **THEN** the document, localStorage and the JSON export are unchanged

#### Scenario: No drag on open

- **WHEN** the menu button receives a pointer press
- **THEN** no drag starts and no item is moved

#### Scenario: No new storage key

- **WHEN** the menu is used repeatedly
- **THEN** no new storage key, field or persistent preference is created

### Requirement: Reused behavior and safe accessible rendering

The commands moved into the menu SHALL keep the same validations, ordering
restrictions, notifications, persistence and undo operations as before. Labels
SHALL stay French, targets at least 44 × 44 px, any animation SHALL respect
`prefers-reduced-motion`, and user titles MUST render as text nodes, never HTML.

#### Scenario: Moved commands behave as before

- **WHEN** a command is activated from the menu
- **THEN** its result, validation, persistence and undo behavior equal the previous inline control

#### Scenario: Markup shown literally

- **WHEN** a title contains markup such as `<img src=x onerror=alert(1)>` and its menu is rendered
- **THEN** the title is displayed literally and creates no element

#### Scenario: Reduced motion honored

- **WHEN** `prefers-reduced-motion` is enabled
- **THEN** no non-essential animation is played for the menu

#### Scenario: No horizontal overflow on mobile

- **WHEN** an open menu is shown at a usual mobile width
- **THEN** it stays within the viewport without horizontal overflow or clipped commands
