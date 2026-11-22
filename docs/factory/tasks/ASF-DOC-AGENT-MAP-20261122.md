# ASF-DOC-AGENT-MAP-20261122 | Agent guidance progressive disclosure

Status: ready
Type: factory
Automation: manual
Date: 2026-11-22

## Objective

Refactor the root agent instructions into a short navigation map and move ASF-specific guidance to `agents-asf.md` without changing runtime workflows.

## Acceptance checklist

- [x] Root `AGENTS.md` has fewer than 100 lines and links to task-specific documents.
- [x] ASF-only procedures and constraints are available in `agents-asf.md`.
- [x] Common safety/privacy instructions have a direct non-ASF entry point.
- [x] Update live cross-references and test assertions to the new contract owners.
- [ ] Verify `npm run check` in CI on the exact PR head.
- [ ] Confirm protected PR merge and post-merge CI/Pages when available.

## Risks and exclusions

Documentation and test-only changes. Do not change GitHub Actions, agent runners, paid prompts, secrets, production code, or branch protections. Keep historical documentation intact where it describes prior decisions.
