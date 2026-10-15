---
schema_version: 2
id: TS-XXX
type: product
status: proposed
priority: normal
# Generation default for a complete, well-characterized product task.
# Explicit contraindications (type: factory, risk medium/high/unknown, or a
# historical task with no automation) override this default to manual.
automation: allowed
# Never infer low from missing information. unknown is not automatically executable.
risk: unknown
depends_on: []
created_at: YYYY-MM-DD
---

# TS-XXX | Brief capability title

Status, priority, dependencies and eligibility are declared in the YAML
frontmatter above; the body describes the work. `automation: allowed` is a
declarative eligibility only and never authorizes a paid run, a merge or a
change to code, secrets or permissions. See
[docs/factory/backlog-v2-task-contract.md](../../docs/factory/backlog-v2-task-contract.md).

## User value
State the user problem and the intended outcome in one or two sentences.

## Scope
List observable behaviors. Keep one independently testable outcome per task.

## Acceptance criteria
- [ ] A user-facing, verifiable behavior.
- [ ] Persistence and accessibility if applicable.
- [ ] Regression tests are updated and `npm run check` passes.

## Implementation constraints
- Keep the existing app architecture unless otherwise agreed.
- Preserve existing data and public browser URLs.

## Out of scope
Explicitly identify features not included in this task.

## Assumptions or decisions
Identify open questions that must be answered before implementation, or write 'None'.
