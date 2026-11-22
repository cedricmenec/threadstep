# Tasks

## Implementation checklist

## 1. Separate the route presentations

- [ ] 1.1 Group Overview-only controls and hide/show that group from the current route; verify the detail route has no Overview heading, project creation, or project filter and Overview restores them.
- [ ] 1.2 Keep the completed-task filter available in detail as a transient control; verify toggling it changes visible tasks without changing storage or document data.

## 2. Add direct project switching

- [ ] 2.1 Add detached project ID/title options to the detail snapshot and a validated command that opens the selected stable-ID route; verify selecting B from A changes the route directly and does not mutate project data.
- [ ] 2.2 Add the deterministic selector-route test in `tests/ts-072-project-detail.test.mjs` and run it with `node --test tests/ts-072-project-detail.test.mjs`; assert project labels, selected ID, destination-focus intent, route history, and refusal of unknown IDs.

## 3. Present only supported project details

- [ ] 3.1 Recompose the detail header, project selector, task list, and derived summary; verify unsupported metadata, search/sort controls, sharing/archive actions, and activity placeholders are absent while title and counts are correct.
- [ ] 3.2 Preserve task controls and the next-action/progress summary only when derived from the selected project's existing records; verify task mutations still target that project and the existing task-level date controls remain disabled.

## 4. Responsive and integration verification

- [ ] 4.1 Apply existing design tokens and narrow-screen layout rules; verify responsive DOM/style assertions at 320, 390, 430, 768, and 1280 px, including 44 px minimum targets and no fixed-width overflow.
- [ ] 4.2 Run targeted TS-072 tests, `npm run check`, `npm run build`, `npm run verify:build`, strict OpenSpec validation, and the OpenSpec task-phase validator; record the actual result of every command before OPSX sync.

## Manual acceptance

Compare the detail page with Stitch « Projet - Détail et Gestion des Tâches » and the user-provided capture. Check an empty and populated project, a long title, multiple projects, an absent project ID, and completed tasks. Inspect 320/390/430/768/1280 px, keyboard selection and focus after switching/returning, browser Back/Forward, reader names, touch targets, scroll, and the absence of horizontal overflow. The Stitch page was not accessible during planning, so exact visual comparison remains unverified until it can be opened.

## Post-sync review

- Compare the synchronized semantic diff with both approved deltas and the archived change.
- Verify the independent PR check on the exact final head SHA and confirm no protected-file or unrelated changes.
- After merge, verify CI on `main` and the Pages deployment on the merge SHA.
- Report the visual, responsive, keyboard, touch, and screen-reader acceptance separately from automated checks.
