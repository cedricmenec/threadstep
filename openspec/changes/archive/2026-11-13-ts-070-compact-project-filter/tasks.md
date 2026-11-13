# Tasks

## 1. Replace the filter control

- [x] 1.1 Replace the four Overview radio controls with one labelled native select and connect its value to the existing filter state; verify initial value, all four options and each filter transition in focused tests.
- [x] 1.2 Style the label and select as a compact responsive row using existing tokens; verify automated assertions for focus styling, minimum target size and overflow with `node --test tests/ts-070-compact-project-filter.test.mjs`.

## 2. Verify behavior and integration

- [x] 2.1 Run automated tests for native selection, unchanged filtering results, focus retention and independent transient state with `node --test tests/ts-054-overview-urgency-filter.test.mjs tests/ts-055-overview-project-filter.test.mjs tests/ts-066-overview-visual.test.mjs tests/ts-070-compact-project-filter.test.mjs`.
- [x] 2.2 Run `npm run check`, `npm run build`, `npm run verify:build` and strict OpenSpec validation; record successful output before synchronization.

## Manual acceptance

Check the actual Overview in desktop and phone browsers. Confirm the filter is visibly more compact, the selected mode is clear, all options work with keyboard and touch, focus remains usable after selection, and the long option labels do not overflow. These checks require a real browser/device and are not proven by static tests.

## Post-sync review

Compare the synchronized `overview-urgency-filter` requirement with the implementation; verify archive and strict validation; inspect CI on the exact PR SHA; merge only through the repository's permitted native auto-merge path; then verify CI on `main` and Pages deployment.
