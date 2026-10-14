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
