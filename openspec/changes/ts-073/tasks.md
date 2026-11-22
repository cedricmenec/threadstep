# Tasks

## 1. Project card rendering

- [ ] 1.1 Simplify the Overview adapter and card surface to expose project name, canonical total and urgent counts, and one project-open action; add deterministic render tests for exact counts, unique navigation, and absent task rows.
- [ ] 1.2 Remove global Overview-only summaries, filters, urgency lists and task previews while preserving project creation and read/loading states; add DOM assertions for the rendered page sections and empty state.
- [ ] 1.3 Update responsive styles and tests so project cards wrap and retain a visible keyboard focus target without horizontal overflow indicators at narrow widths.

## 2. Regression and checks

- [ ] 2.1 Add or adapt deterministic tests for same-context card refresh, focus continuity, project navigation, and no persistence side effects; run the targeted Overview test files.
- [ ] 2.2 Synchronize the Overview and metrics component guides and verify their documented structure matches the implementation.
- [ ] 2.3 Run `npm run check`, `npm run build`, `npm run verify:build`, strict OpenSpec validation and `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-073/tasks.md`.

## Manual acceptance

Inspect the overview in a real browser at 320, 390, 430, 768 and 1280 px; verify long project names, empty and populated workspaces, pointer/touch activation, Tab/Enter operation, focus visibility, screen reader names, and navigation to the correct project. Confirm task management remains available in project detail. Record actual browsers and devices; automated DOM assertions do not prove these checks.

## Post-sync review

Review the semantic spec diff and archived change, verify independent PR CI on the exact head SHA, then check main CI and Pages only after an authorized merge. Report remote verification, merge, deployment and manual acceptance as separate statuses.
