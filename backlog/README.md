# Backlog

Tasks are versioned Markdown files under `backlog/tasks/`. Each task declares an ID, scope and acceptance criteria. The `Agent` workflow accepts a task ID and reads its file.

## Status
- TS-001: done in the initial MVP implementation (pending independent CI confirmation).
- TS-002: planned: real end-to-end agent run on a deliberately small, reviewable improvement.
- TS-003: planned: factory hardening with validated auto-merge and dependency-based waves, only after TS-002.

Future tasks should remain small enough for one bounded agent run. Dependencies and priorities can be added as machine-readable frontmatter when a dispatcher is implemented.
