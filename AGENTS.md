# ThreadStep agent contract

## Product
ThreadStep is a tiny, French-language, browser-only next-step dashboard for people juggling parallel subjects. It is NOT a project-management platform.

## Constraints
- Public repository and public GitHub Pages deployment. **Never commit secrets or OpenRouter keys.**
- No backend, database service, account, authentication, telemetry or paid runtime dependencies.
- Local data in browser localStorage (key: `threadstep.document.v1`), with explicit JSON export and import.
- Static website in `site/`; keep relative URLs compatible with `/threadstep/` on GitHub Pages.
- Favor accessible semantic HTML, responsive/mobile UI, no third-party JS bundles.
- Keep all untrusted user-provided strings as text nodes, not `innerHTML`.
- Preserve backwards compatibility of exported JSON or write an explicit migration.
- Treat `docs/product/` as product intent and `backlog/tasks/` as implementation scope.

## Development
- Work on the prepared agent branch only; do not push to main.
- For each task, read its acceptance criteria before editing.
- Run `npm run check` and report exactly what was executed.
- Do not change GitHub workflows, credentials, `opencode.json`, or this file during routine feature work.
- Never report an unverified test as passed.
- Do not merge pull requests; human approval is required during the pilot.

## Mandatory documentation for factory evolution

- Every change to the software factory (GitHub Actions workflows, OpenCode/OpenSpec orchestration, GitHub App authentication, agent policy, CI/security, delivery or cost controls) MUST include a dedicated documentation task/checklist item in the same PR.
- Update the relevant files under `docs/factory/` to describe the actual behavior, configuration, operational steps, safety limits and validation status. Update the roadmap/decisions when capabilities or trade-offs change.
- A factory PR is not complete until its documentation task is checked off and the PR description identifies the documentation files changed. If documentation is not needed, document a specific justification in the PR instead of silently omitting it.
- Do not publish secrets, tokens, private keys or sensitive configuration values in documentation. Distinguish implemented behavior from untested assumptions.
- Factory changes require an explicitly authorized, separately reviewed PR; routine feature agents must not edit protected factory files.

## Backlog intake and planning protocol
- This file is the durable, repository-wide operating contract. It explains how to work; it is NOT the backlog itself.
- Before planning a new feature, read `docs/product/vision.md`, `docs/product/mvp.md`, `backlog/README.md`, and the relevant existing tasks. Avoid duplicates.
- When a user describes a feature in natural language (including a voice request), the planning assistant prepares a focused specification; do not ask the user to write GitHub issues or Markdown files.
- Use the next free `TS-NNN` ID after inspecting `backlog/tasks/`. Create one Markdown file per small, independently testable change under `backlog/tasks/TS-NNN.md`, following `backlog/tasks/TEMPLATE.md`.
- Include user value, scope, functional behavior, acceptance criteria, validation/testing, assumptions, and explicit out-of-scope behavior. Include dependencies and priority if relevant. Clarify only decisions that materially alter scope, data safety or security.
- Update `backlog/README.md` and the canonical product specifications when requirements change. Separate planning artifacts from code changes, preserving reviewable history.
- A planned or ready task is NOT permission to run an LLM, incur OpenRouter costs, merge a PR, or modify implementation code. Obtain explicit execution authorization; never assume that backlog order constitutes it.
- The legacy `Agent (manual, OpenRouter)` workflow implements directly from backlog with `task_id` through `workflow_dispatch`.
- The separate `Agent OpenSpec (manual, staged or auto)` workflow offers `phase=plan` (draft only), `phase=apply` (reviewed plan) and `phase=auto` (plan, validate, implement, sync and archive in one explicitly authorized run). Each invoked phase uses a paid model; auto authorizes both calls in a single run. No orchestrator or automatic merge is enabled.
- The selected task maps to deterministic `openspec/changes/ts-nnn/` and must be checked against the product acceptance criteria. Do not treat a plan approval as consent to launch apply automatically. Automated priority selection and wave execution remain future capabilities.
- Keep changes to agent policy and backlog conventions in a dedicated reviewed PR. A routine coding task must not edit `AGENTS.md` or workflow/security files.
