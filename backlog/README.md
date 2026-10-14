# Backlog

Task specifications live in `backlog/tasks/TS-NNN.md` as versioned Markdown files. Use `backlog/tasks/TEMPLATE.md` for new tasks and `AGENTS.md` for repository-wide agent conventions. Product intent belongs in `docs/product/`.

## How to request a new feature
Describe the need in natural language or by voice. The planning assistant inspects the existing product specification and backlog, assigns the next available task ID, breaks down oversized work, writes the acceptance criteria, and commits a task file and any required product-spec updates to a reviewable branch. The user does **not** have to create an issue, write Markdown, or choose a filename.

## How implementation currently works
The legacy OpenCode workflow remains manually dispatched with an existing `task_id` (and an OpenRouter model) after the task has been merged into `main`. For spec-driven development, use **Agent OpenSpec (manual, staged)** with `task_id`, then manually run `phase=plan` to create the change and review its draft PR. Only after review, manually run `phase=apply` for implementation and archive. **Both phases call a paid model** and require their own explicit trigger; writing a task is not execution authorization. The workflows never automatically choose tasks or merge PRs. A dispatcher, budget enforcement and safe auto-merge remain future work.

## Current tasks
- **TS-001**: initial static MVP, implemented and validated.
- **TS-002**: OpenCode smoke test on README, implemented as [PR #2](https://github.com/cedricmenec/threadstep/pull/2) (pilot PR; human handling).
- **TS-003**: safe autonomous waves, backlog only; not authorized for execution.
- **TS-004**: subject reordering with up/down controls, implemented via the OpenCode pilot.
- **TS-005**: edit an existing action/substep title and priority while preserving completion, hierarchy and local data; implemented and merged via OpenSpec PR #8.
- **TS-006**: temporarily hide completed actions and substeps while retaining unfinished children of completed parents; ready for explicit manual legacy Agent execution after merge.

Keep tasks small enough for one bounded agent run. Priorities/dependencies remain documented in the Markdown text during the pilot; a machine-readable scheduler is not installed.
