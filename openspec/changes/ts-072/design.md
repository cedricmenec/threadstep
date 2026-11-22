# Design

## Context

The router selects `#/sujet/<id>` and mounts one React detail root in the existing `#subjects` container. That container sits inside the Overview dashboard, whose heading, project creation form, completion filter, and project filter are separate static DOM controls. The detail adapter currently snapshots only the selected project. See `proposal.md` and the delta specs for user-visible requirements.

## Goals / Non-Goals

**Goals:**
- Keep Overview and detail routes inside the existing app shell while rendering only the relevant view controls for each route.
- Reuse route IDs, project/task data, controller commands, semantic tokens, and existing task operations.
- Preserve the detail's completed-task filter and move its control into the detail surface.

**Non-Goals:**
- Change the hash route format, data model, persistence, task rules, or other routes.
- Add project metadata, search, project filtering/sorting, sharing, archiving, or activity tracking.

## Decisions

1. **Keep the shared dashboard container and hide its Overview control group on detail routes.** Group the static Overview controls so the controller can hide them as one unit and update the dashboard's accessible label. Keep `#subjects` as the only content mount point; creating a second page root would add lifecycle and scroll ownership without changing route behavior. Loading, recovery, and authorization states continue to use existing boundaries.

2. **Build project options from detached ID/title pairs and navigate through the existing controller.** Extend only the detail adapter snapshot with project IDs and text titles. A native labeled `<select>` invokes an explicit `openProject` command; the application validates the target against the current document, then uses the existing `openSubject` path so stable routes, history, route-boundary teardown, and destination-heading focus remain consistent. It does not write data or preferences.

3. **Keep the completion filter transient and expose it in the detail surface.** The existing controller already owns `hideCompleted` and the task list already consumes it. Add a named controller command for the checkbox and leave the Overview checkbox and behavior in place when its control group is visible.

4. **Render only truthful project summary content.** Remove unsupported project metadata and inactive project controls. Derive progress from existing task data and show a next action only when an unfinished task is present; omit activity because the product records no activity feed. Keep the task-level date/calendar placeholder disabled under its existing contract.

5. **Use existing semantic color, spacing, width, border, and control-size tokens.** Recompose the detail header, switcher, task list, and summary for a roomy desktop column and a single narrow-screen column. Do not add remote resources or fonts. Keep real-browser viewport and visual comparison in Manual acceptance.

## Risks / Trade-offs

- [Changing the shared dashboard structure could hide a control on another route] → Toggle the Overview group only from the route rendering branch and cover Overview/detail transitions with deterministic tests.
- [Project switching can leave stale task content or focus] → Reuse `openSubject`, keyed React boundary invalidation, and the existing destination-heading focus path; test A→B→Back and missing-project cases.
- [A summary could imply a priority rule that does not exist] → Use an actual unfinished top-level task already in the project's display order and label it as the next action only when present; do not synthesize activity or metadata.
- [Desktop styles may overflow on narrow screens] → Keep grid children shrinkable, controls at least 44 px high, and test responsive CSS and DOM at the specified widths; keep physical-device acceptance separate.

## Migration Plan

No data migration is needed. Deploy through the normal static build. Rollback is the prior reviewed PR; route and stored data formats stay compatible.

## Open Questions

None. The backlog and user request authorize the visual direction, direct selector, removal of unsupported project placeholders, and preservation of task behavior.
