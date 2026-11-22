# Proposal

## Why

The current project detail is inserted into the Overview section, leaving Overview-only controls and non-functional Stitch placeholders around a single project's tasks. A dedicated detail composition and direct project switcher will make the current project easier to read and move between without losing its stable route or existing task controls.

## What Changes

- Give the detail route a dedicated page composition without Overview-only headings, creation controls, or project filters.
- Keep the completed-step filter available inside detail and provide a native, accessible project selector that navigates directly between stable project routes.
- Present project information only when it is derived from existing data; remove project metadata, search, filters, sharing/archive controls, and summary placeholders that have no implemented source or behavior.
- Preserve the return-to-overview control, task behavior, route history, data, and presentation-only navigation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `subject-detail-view`: define the standalone detail composition and direct switching to another project from detail.
- `react-project-detail-pilot`: replace the requirement to render static project placeholders with a requirement to omit unsupported project details and use only truthful derived values.

## Impact

- `site/index.html`, `site/app.js`, `site/react-adapter.js`, `site/project-detail/ProjectDetail.jsx`, and `site/styles.css`.
- Deterministic tests for route transitions, detail rendering, task filtering, accessible project selection, and navigation side effects.
- No data schema, route format, persistence key, export format, dependency, cloud behavior, or task mutation API changes.
- The Stitch project could not be opened in the browser during exploration. The user-provided screenshot, the approved task, and existing local design tokens guide implementation; visual matching still requires manual acceptance.
