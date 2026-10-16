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
2. `CI` validates every PR independently (Node tests, Actionlint, embedded Bash syntax, strict OpenSpec).
3. `Pages` runs after changes reach `main`, deploys only `site/`.
4. Two owner-dispatched **manual agent** workflows exist: `Agent (manual, OpenRouter)` (direct, `TS-NNN`) and `Agent OpenSpec (manual, staged or auto)` (plan/apply/auto/finalize, accepts `11` or `TS-011`). Both execute OpenCode on a dedicated branch and open a PR through the GitHub App; no paid run starts on pushes or PRs.
5. An additional owner-dispatched **Backlog Orchestrator V1** authorizes 1 or 2 sequential OpenSpec product-task starts (`mode=dry-run|execute`), with a frozen manifest, a durable journal and independent post-merge CI/Pages verification before the next paid task. [Developer guide](factory/developer-guide.md). No paid model runs automatically on public PRs, issues or pushes. For final agent PRs, the owner may disable `auto_merge`; if enabled, GitHub merges only after required `check` CI. Auto-merge is demonstrated on TS-010 (#32) and TS-011 (#34), followed by Pages.

## Security and budget
- API key exists only in GitHub Actions repository secrets, never in frontend assets.
- Agent executes only via explicitly authorized GitHub Actions dispatch and owner-only guard.
- Workflow jobs have narrow permissions and a 20-minute timeout.
- No untrusted pull request receives OpenRouter secrets.
- An independent `check` CI and the active `Protect Main` branch ruleset gate merge. GitHub native auto-merge is tested for OpenSpec; the owner still authorizes paid workflow starts. The bounded V1 wave orchestrator is delivered; expanding to 10 tasks remains future work.
- Run-level budgets depend on OpenRouter account limits and the selected model; GitHub timeout alone is not a hard spend cap.

## Future generic factory
Extract reusable workflows and policies into their own versioned repository or reusable GitHub workflows after validating one real delivery. Keep business logic separate from factory orchestration.
