# Backlog

Task specifications live in `backlog/tasks/TS-NNN.md` as versioned Markdown files. Use `backlog/tasks/TEMPLATE.md` for new tasks and `AGENTS.md` for repository-wide agent conventions. Product intent belongs in `docs/product/`.

## How to request a new feature
Describe the need in natural language or by voice. The planning assistant inspects the existing product specification and backlog, assigns the next available task ID, breaks down oversized work, writes the acceptance criteria, and commits a task file and any required product-spec updates to a reviewable branch. The user does **not** have to create an issue, write Markdown, or choose a filename.

## How implementation currently works
The agent workflow is manually dispatched with an existing `task_id` (and an OpenRouter model) after the task has been merged into `main`. It does not automatically choose the next ready task, merge pull requests or launch development merely because a task file exists. A dispatcher, explicit budget authorization and safe auto-merge are future work.

## Current tasks
- **TS-001**: initial static MVP, implemented and validated.
- **TS-002**: OpenCode smoke test on README, implemented as [PR #2](../../pull/2) (pilot PR; human handling).
- **TS-003**: safe autonomous waves, backlog only; not authorized for execution.
- **TS-004**: subject reordering with up/down controls, ready for explicit agent dispatch once this specification is merged.

Keep tasks small enough for one bounded agent run. Priorities/dependencies remain documented in the Markdown text during the pilot; a machine-readable scheduler is not installed.
