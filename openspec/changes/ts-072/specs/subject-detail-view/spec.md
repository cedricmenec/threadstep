# Spec Delta

## ADDED Requirements

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
