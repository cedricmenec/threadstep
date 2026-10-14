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

## Backlog intake and planning protocol
- This file is the durable, repository-wide operating contract. It explains how to work; it is NOT the backlog itself.
- Before planning a new feature, read `docs/product/vision.md`, `docs/product/mvp.md`, `backlog/README.md`, and the relevant existing tasks. Avoid duplicates.
- When a user describes a feature in natural language (including a voice request), the planning assistant prepares a focused specification; do not ask the user to write GitHub issues or Markdown files.
- Use the next free `TS-NNN` ID after inspecting `backlog/tasks/`. Create one Markdown file per small, independently testable change under `backlog/tasks/TS-NNN.md`, following `backlog/tasks/TEMPLATE.md`.
- Include user value, scope, functional behavior, acceptance criteria, validation/testing, assumptions, and explicit out-of-scope behavior. Include dependencies and priority if relevant. Clarify only decisions that materially alter scope, data safety or security.
- Update `backlog/README.md` and the canonical product specifications when requirements change. Separate planning artifacts from code changes, preserving reviewable history.
- A planned or ready task is NOT permission to run an LLM, incur OpenRouter costs, merge a PR, or modify implementation code. Obtain explicit execution authorization; never assume that backlog order constitutes it.
- The existing `Agent (manual, OpenRouter)` workflow does not discover tasks: it requires a specific `task_id` through `workflow_dispatch`. Automated priority selection and wave execution are future capabilities.
- Keep changes to agent policy and backlog conventions in a dedicated reviewed PR. A routine coding task must not edit `AGENTS.md` or workflow/security files.
