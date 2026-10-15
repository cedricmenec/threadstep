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
- For OpenSpec changes, ensure every checkbox in tasks.md can be completed during apply before OPSX sync and archive. Specify post-sync semantic diffs, archive checks and independent CI review in a separate non-checkbox review section. Never mark a post-sync check complete before it has run.
- Run `npm run check` and report exactly what was executed.
- Do not change GitHub workflows, credentials, `opencode.json`, or this file during routine feature work.
- Never report an unverified test as passed.
- Do not merge pull requests directly or bypass status checks. The two owner-dispatched agent workflows may optionally request GitHub native auto-merge after publishing a final PR, if the repository's active main ruleset requires the independent CI `check` job and the matching head SHA is verified. OpenSpec `plan` PRs are never auto-merged. On missing protections, fail closed and leave the PR open.

## Mandatory documentation for factory evolution

- Every change to the software factory (GitHub Actions workflows, OpenCode/OpenSpec orchestration, GitHub App authentication, agent policy, CI/security, delivery or cost controls) MUST include a dedicated documentation task/checklist item in the same PR.
- Update the relevant files under `docs/factory/` to describe the actual behavior, configuration, operational steps, safety limits and validation status. Update the roadmap/decisions when capabilities or trade-offs change.
- A factory PR is not complete until its documentation task is checked off and the PR description identifies the documentation files changed. If documentation is not needed, document a specific justification in the PR instead of silently omitting it.
- Do not publish secrets, tokens, private keys or sensitive configuration values in documentation. Distinguish implemented behavior from untested assumptions.
- Factory changes require an explicitly authorized, separately reviewed PR; routine feature agents must not edit protected factory files.
- The OpenSpec workflow must initialize OpenCode skills/commands on the ephemeral runner and verify they exist before paid agent calls. Generated instructions must not be committed with a feature PR.
- Semantic sync must use the OpenCode OPSX command when available and verify the exact contents of non-canonical files before/after sync; compare deltas against canonical specs in human review. This native OPSX command and content-scope guard were tested end-to-end on TS-009 (run 38712079641, merged PR #26). REMOVED and RENAMED operations remain untested.

## Backlog intake and planning protocol
- This file is the durable, repository-wide operating contract. It explains how to work; it is NOT the backlog itself.
- Before planning a new feature, read `docs/product/vision.md`, `docs/product/mvp.md`, `backlog/README.md`, and the relevant existing tasks. Avoid duplicates.
- When a user describes a feature in natural language (including a voice request), the planning assistant prepares a focused specification; do not ask the user to write GitHub issues or Markdown files.
- Use the next free `TS-NNN` ID after inspecting `backlog/tasks/`. Create one Markdown file per small, independently testable change under `backlog/tasks/TS-NNN.md`, following `backlog/tasks/TEMPLATE.md`.
- Include user value, scope, functional behavior, acceptance criteria, validation/testing, assumptions, and explicit out-of-scope behavior. Include dependencies and priority if relevant. Clarify only decisions that materially alter scope, data safety or security.
- Update `backlog/README.md` and the canonical product specifications when requirements change. Separate planning artifacts from code changes, preserving reviewable history.
- A planned or ready task is NOT permission to run an LLM, incur OpenRouter costs, merge a PR, or modify implementation code. Obtain explicit execution authorization; never assume that backlog order constitutes it.
- The legacy `Agent (manual, OpenRouter)` workflow implements directly from backlog with `task_id` through `workflow_dispatch`.
- The separate `Agent OpenSpec (manual, staged or auto)` workflow offers `phase=plan` (draft only), `phase=apply` (reviewed plan) and `phase=auto` (plan, validate, implement, sync and archive in one explicitly authorized run), plus `phase=finalize` (validate, semantically sync and archive already committed work with a paid OpenCode/OpenRouter call). Apply and auto also use an additional paid semantic sync call following the OPSX sync workflow; auto can therefore invoke the model three times in a single authorized run. No orchestrator is enabled. Both agents expose `auto_merge=true` by default for final PRs, but native auto-merge requires verified branch protection and independent `check` CI; default is not permission to bypass checks.
- The OpenSpec workflow_dispatch form preselects `auto` and `openrouter/deepseek/deepseek-v4.1-flash`; these are convenience defaults, not permission to execute. It accepts a 1-3 digit number (e.g. `9`, `009`) or canonical `TS-009` and normalizes to `TS-NNN` before backlog validation, branch naming and model calls. Reject `0`, out-of-range and malformed values. Each canonical OpenSpec task has its own concurrency group, avoiding alias races while allowing independent tasks to run in parallel. The direct legacy workflow is unchanged.
- The selected task maps to deterministic `openspec/changes/ts-nnn/` and must be checked against the product acceptance criteria. Do not treat a plan approval as consent to launch apply automatically. Automated priority selection and wave execution remain future capabilities.
- Keep changes to agent policy and backlog conventions in a dedicated reviewed PR. A routine coding task must not edit `AGENTS.md` or workflow/security files.

## Dedicated ASF development agent (manual, reviewed)

- The `Agent ASF (manual, OpenRouter, reviewed PR)` workflow is a separate **owner-only** path for explicitly selected `docs/factory/tasks/ASF-V2-NNN.md` tasks. It does not weaken the routine ThreadStep product-agent restrictions above.
- The task-specific, versioned allowlist in `scripts/agent-asf-policy.mjs` is checked before publication. The development job has no GitHub App write token. Privileged publication runs only after a validated patch and produces a PR for human review, never an auto-merge request.
- Manual dispatch authorizes a **paid** task execution only. Task status/priority does not authorize API costs, changes of secrets or GitHub settings, or PR merge. The model provider key is available only to the paid development step.
- For ASF-V2-008/009, workflow file publication additionally requires the installed App to have `Workflows: write`; if absent, fail closed. Do not grant or change that permission without explicit authorization.
- Factory changes always require independent CI, checked documentation within the same PR, explicit merge authorization, and honest post-merge verification. See `docs/factory/agent-asf-manual.md`.
