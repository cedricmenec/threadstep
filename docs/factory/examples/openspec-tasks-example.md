# Example OpenSpec tasks.md | executable pre-sync checklist

This is a **template for the structure**, not an active OpenSpec change.
Adapt the tasks to the selected backlog scope. Do not copy example IDs into
real change artifacts without checking the feature.

## Implementation checklist (apply, before OPSX sync)

- [ ] 1.1 Implement the smallest change meeting the delta spec, without changing protected paths.
- [ ] 1.2 Add deterministic unit/integration tests for the 0/1/5/6 input boundaries, unchanged data and accessible control attributes where the test runner can check them.
- [ ] 1.3 Run `npm run check` and `openspec validate <change-id> --strict --no-interactive`; report actual results and do not check if failing.

## Manual acceptance

- On an actual desktop and mobile browser, inspect the rendered component and responsive layout; capture any failures.
- Test the real keyboard/focus flow, touch targets, and screen-reader output with accessible tooling or a human tester.
- Review actual browser localStorage/export/import and history navigation as applicable to the feature.
- These are **pending human acceptance**, not completed by virtue of a green Node test, and contain **no checkbox**.

## Post-sync review

- After the separate OPSX semantic sync step, review actual canonical spec deltas against the intended ADDED/MODIFIED/REMOVED/RENAMED behavior.
- Check the archived OpenSpec change and its versioned content.
- After the PR is published, verify independent GitHub `check` on its exact SHA, required protection, the merge evidence and post-merge CI/Pages.
- This stage is external to `apply`; these reviews contain **no checkbox** and must never be marked complete before their evidence exists.
