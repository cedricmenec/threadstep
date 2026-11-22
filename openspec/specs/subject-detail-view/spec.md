# subject-detail-view Specification

## Purpose

Lets the user open one subject in a roomier, dedicated view reachable by a
stable-id fragment route, with the existing task controls and an accessible
fallback, while navigation itself never changes stored data.

## Requirements

### Requirement: Detail route by stable subject id

A client-side URL fragment SHALL open the detail view of one subject identified
only by its stable `id`, never by title or position. The route SHALL be relative
and GitHub Pages-compatible and MUST NOT require a new data file, storage key,
framework or network request.

#### Scenario: Open a valid route

- **WHEN** the fragment targets an existing subject id
- **THEN** that subject's detail view is shown

#### Scenario: Route follows the id

- **WHEN** a subject's title changes or the subjects are reordered
- **THEN** the same fragment still opens that same subject

#### Scenario: Opening uses no network or new data file

- **WHEN** a detail route is opened
- **THEN** no network request is made and no new data file or storage key is used

### Requirement: Open control on overview cards

Each overview subject SHALL expose an explicit French « Ouvrir le projet »
control in its card header, with an accessible name naming the subject.
Activating it SHALL open that subject's detail route without triggering the
card's other controls, its forms or drag-and-drop.

#### Scenario: Open control is present

- **WHEN** the overview renders a subject card
- **THEN** it shows « Ouvrir le projet » with an accessible name naming the subject

#### Scenario: Opens the targeted subject

- **WHEN** the control of subject A is activated
- **THEN** the detail view of A is shown

#### Scenario: No other action is triggered

- **WHEN** the « Ouvrir le projet » control is activated
- **THEN** no edit, removal, move or drag starts and no form is submitted

### Requirement: Single-subject detail presentation

The detail view SHALL show the subject title, its own unfinished-step count, and
only its top-level tasks and their direct substeps, in a more spacious layout
than the overview. It MUST NOT render the other subjects' cards.

#### Scenario: Only the target subject appears

- **WHEN** the detail view of A is open
- **THEN** A's title, counter and steps are shown and the B and C cards are absent

#### Scenario: Roomier than the overview

- **WHEN** the detail view renders a subject
- **THEN** its presentation is more spacious than the overview card

#### Scenario: Subject-local pending count

- **WHEN** A has unfinished steps
- **THEN** the detail counter reflects A's unfinished steps

### Requirement: Reused task behaviors and restrictions

In the detail view, adding, editing, completing, collapsing, filtering,
reordering within the allowed groups, removing and undoing a task or substep
SHALL reuse the existing functions and MUST keep the same validations, priority,
parent, filter and ordering restrictions as the overview.

#### Scenario: Same result as the overview

- **WHEN** a task operation is performed in the detail view
- **THEN** the resulting document equals the same operation performed in the overview

#### Scenario: Hidden substeps cannot be manipulated

- **WHEN** a substep is hidden by the completed filter or a collapsed parent
- **THEN** no handle and no drop target is offered for that substep

#### Scenario: Invalid reorder is refused

- **WHEN** a reorder or drop outside the allowed subject, parent and priority group is attempted
- **THEN** nothing moves and nothing is saved

### Requirement: Shared document and immediate coherence

Both views SHALL read and mutate the same document and the same ids, with no
project, task or substep copy and no divergent business state. A change made in
the detail view SHALL appear immediately in the overview, the global counter,
« Je reprends ici », « Une étape pour maintenant » and the JSON export.

#### Scenario: Detail change visible in the overview

- **WHEN** a task is completed in the detail view
- **THEN** the overview and the global counter reflect the change

#### Scenario: Export reflects detail changes

- **WHEN** a change is made in the detail view and the document is exported
- **THEN** the exported JSON contains that change

#### Scenario: No duplicate entities

- **WHEN** the detail view is open
- **THEN** no second copy of the subject, task or substep exists

### Requirement: Return, history and accessible fallback

A « Retour à la vue d'ensemble » control SHALL return to the cards. Browser
Back/Forward and reloading a valid detail route SHALL restore the correct view.
An invalid route, or a subject id absent after import or removed meanwhile, SHALL
show an accessible fallback with a return control and MUST NOT create or modify
any subject.

#### Scenario: Return control

- **WHEN** the user activates « Retour à la vue d'ensemble »
- **THEN** the overview is shown

#### Scenario: Browser navigation and reload

- **WHEN** the user presses Back or Forward, or reloads a valid detail route
- **THEN** the matching view is restored

#### Scenario: Missing subject fallback

- **WHEN** the route id is not present in the current document
- **THEN** an accessible message and a return control are shown and nothing is created or modified

#### Scenario: Malformed route fallback

- **WHEN** the fragment is malformed
- **THEN** the accessible fallback is shown without creating or modifying any subject

### Requirement: Presentation-only navigation

Opening, closing and switching between views SHALL be presentation operations.
They MUST NOT write localStorage, modify the document, create a persistent
preference or add a new storage key.

#### Scenario: No write without a business action

- **WHEN** a detail view is opened and closed without a business action
- **THEN** the document, localStorage and the JSON export are strictly unchanged

#### Scenario: No new field or key

- **WHEN** views are switched repeatedly
- **THEN** no new field, id, storage key or persistent preference is created

### Requirement: Accessible, mobile and safe detail view

Access, return, rename and step controls SHALL be usable by keyboard (Tab,
Enter, Space), mouse and touch, with French accessible names, coherent focus
after navigation, semantic structure, touch targets of at least 44 × 44 px, and
titles rendered as text nodes, respecting `prefers-reduced-motion`.

#### Scenario: Keyboard navigation

- **WHEN** a keyboard-only user opens the detail view, uses a step control and returns
- **THEN** each step is possible and focus stays on a sensible control

#### Scenario: Touch target on a narrow viewport

- **WHEN** the detail view is shown on a narrow touch viewport
- **THEN** its controls provide at least 44 × 44 px touch targets

#### Scenario: Markup shown literally

- **WHEN** a subject or task title contains markup such as `<img src=x onerror=alert(1)>`
- **THEN** it is displayed literally and creates no element

### Requirement: Detail header total task count

The detail view header SHALL show the same total label as the overview card
(« 0 tâche au total », « 1 tâche au total », « N tâches au total ») for the
subject's top-level tasks, beside the existing unfinished-step count. It MUST be
a text node, MUST exclude substeps, MUST include completed tasks and MUST NOT
replace, rename or change the pending count or the navigation.

#### Scenario: Total shown in the detail header

- **WHEN** the detail view of a subject with top-level tasks is open
- **THEN** its header shows the total label in addition to the pending count

#### Scenario: Detail total matches the overview

- **WHEN** the same subject is shown in the overview and in the detail view
- **THEN** both headers show the same total

#### Scenario: Pending count is preserved

- **WHEN** the detail header renders
- **THEN** the existing unfinished-step count and its wording are unchanged

#### Scenario: No write or navigation change

- **WHEN** the detail view is opened, closed or switched without a business action
- **THEN** the document, localStorage and the JSON export are unchanged and the route behavior is unchanged

### Requirement: Dedicated project detail composition

For a valid project detail route, the page SHALL present the selected project and its task controls without Overview-only headings, project-creation controls, or project filters. Existing task filters SHALL remain available in the detail context.

#### Scenario: Detail route omits Overview controls
- **GIVEN** the Overview contains its title, project creation form, completion filter, and project filter
- **WHEN** a valid project detail route is open
- **THEN** only the project detail is presented in the content area
- **AND** Overview-only controls are not visible or available to assistive technology

#### Scenario: Completed-task filter remains available
- **GIVEN** a project has completed and unfinished tasks
- **WHEN** its detail route is open
- **THEN** the user can still hide completed tasks in the detail view
- **AND** changing the filter changes only the visible tasks and does not persist a preference

### Requirement: Switch projects from the detail view

The detail view SHALL expose a labeled native selector containing the existing projects in the current document. Selecting another project MUST navigate directly to that project's stable-id detail route.

#### Scenario: Available projects are named
- **GIVEN** the current document contains projects A and B and detail A is open
- **WHEN** the project selector is rendered
- **THEN** A is selected and A and B are available by their project titles
- **AND** titles are rendered as text

#### Scenario: Select another project without returning to Overview
- **GIVEN** detail A is open and project B exists
- **WHEN** the user selects B
- **THEN** the route changes to B's stable-id detail route
- **AND** B's title and tasks are shown without rendering the Overview
- **AND** focus moves to a meaningful heading in B's detail

#### Scenario: Project switching preserves browser history
- **GIVEN** the user switches from detail A to detail B
- **WHEN** the user uses browser Back or Forward
- **THEN** the matching project detail route is restored

#### Scenario: Project switching changes presentation only
- **GIVEN** detail A is open and no task action is performed
- **WHEN** the user switches to project B and back
- **THEN** project records, tasks, exports, storage, and synchronization state remain unchanged

#### Scenario: Selector works with touch
- **GIVEN** the project detail is open on a narrow touch viewport
- **WHEN** the user opens the project selector
- **THEN** its target is at least 44 by 44 CSS pixels and another project can be selected
