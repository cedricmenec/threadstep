# Architecture

> La documentation de référence de la **software factory générique** est désormais dans [docs/factory/README.md](factory/README.md). Cette page décrit principalement le **pilote ThreadStep**.

## Application
- Static `site/index.html` + CSS and vanilla ECMAScript modules; no build/bundle, no server.
- `site/core.js` contains pure domain functions and schema validation, testable with built-in Node test runner.
- `site/app.js` owns browser DOM/localStorage, import/export, rendering and events.
- No network access by design (CSP connect-src none).
- Public Pages exposes only `site/`, never `docs/` or repository metadata.

## Factory pilot
1. Human + ChatGPT coauthor product intent and backlog under version control.
2. `CI` validates every PR independently with Node.
3. `Pages` runs after changes reach `main`, deploys only `site/`.
4. `Agent` is opt-in using `workflow_dispatch` and a task ID from `backlog/tasks/`. It executes OpenCode with `OPENROUTER_API_KEY` on a dedicated branch, then opens a PR.
5. No automated paid model runs on public PRs, issues, or pushes. No automatic merge during pilot.

## Security and budget
- API key exists only in GitHub Actions repository secrets, never in frontend assets.
- Agent executes only via explicitly authorized GitHub Actions dispatch and owner-only guard.
- Workflow jobs have narrow permissions and a 20-minute timeout.
- No untrusted pull request receives OpenRouter secrets.
- An independent CI pass and human review precede each merge. Add autonomous merge and wave orchestration only after pilot checks.
- Run-level budgets depend on OpenRouter account limits and the selected model; GitHub timeout alone is not a hard spend cap.

## Future generic factory
Extract reusable workflows and policies into their own versioned repository or reusable GitHub workflows after validating one real delivery. Keep business logic separate from factory orchestration.
