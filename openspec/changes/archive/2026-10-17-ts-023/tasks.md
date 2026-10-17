# Tasks

## 1. Pure command model in `site/core.js`

- [x] 1.1 Add a pure, immutable `itemMenuCommands(item, options)` to `site/core.js` returning the ordered command descriptors (`edit`, `remove`, `add-substep`, `promote`, `keep-track`, `move-up`, `move-down`) with their French labels and `disabled` flags derived only from `item.parentId`, `item.done` and the `tracked`, `canMoveUp`, `canMoveDown` options; verify with deterministic Node tests in `tests/core.test.mjs`.
- [x] 1.2 Add deterministic Node tests to `tests/core.test.mjs` asserting the exact command set and order for a top-level task with and without visible substeps, a direct substep, a completed parent, a tracked parent, and the boundary and hidden-completed `disabled` flags, plus non-mutation of the input item; run `node --test tests/core.test.mjs` and report the result.

## 2. App wiring: per-item menu and compact rows

- [x] 2.1 Replace the inline secondary controls in `site/app.js` `renderActions` with a native « ⋮ » menu button labelled « Actions pour <titre> » (`type="button"`, `aria-expanded`, `aria-controls`, ≥ 44 × 44 px) that renders the commands from `itemMenuCommands`, while the completion checkbox, title, priority control, drag handle and disclosure control stay directly on the row; verify with deterministic static-assertion tests reading `site/app.js` and `node --check site/app.js`.
- [x] 2.2 Wire the single `openMenuId` state, the Escape and outside-click closing, the view-change reset and the focus return to the menu button, with no `persist()` call and no drag start on open or close; verify with deterministic static-assertion tests over `site/app.js` (single open menu, absence of `persist()` in the toggle path, presence of the Escape, outside-click and view-reset wiring) and `node --check site/app.js`.
- [x] 2.3 Reuse the existing handlers unchanged for `Modifier`, `Retirer`, `+ Sous-étape`, `Promouvoir en tâche principale`, `Garder le fil` and `Monter`/`Descendre`, closing the menu before a command that re-renders or opens the editor; verify with deterministic static-assertion tests that each menu command calls the existing core function and that `site/core.js` gained no new mutation path.
- [x] 2.4 Add deterministic static-assertion tests reading `site/app.js` and `site/styles.css` that assert the compact-row spacing rules, the preserved hierarchy cues, the `white-space:pre-wrap` notes, the ≥ 44 × 44 px targets, the visible focus outline and the `prefers-reduced-motion` guard, and that no `.innerHTML` is used; run `node --test tests/*.test.mjs` and report the result.
- [x] 2.5 Add deterministic cross-feature non-regression tests proving that counters, suggestion, tracking, removal/undo, notes, promotion, ordering and the JSON export/import round-trip are unchanged by the menu and compact-row change; run `node --test tests/*.test.mjs` and report the result.

## 3. Documentation and final gate

- [x] 3.1 Update `docs/product/mvp.md` (add the compact-row and grouped-actions requirement and update the evolution note so TS-023 is no longer listed as unimplemented) and `docs/product/guide-utilisation.md` (describe the « ⋮ » menu and the keyboard alternative for « Monter »/« Descendre »); verify with deterministic grep and static assertions that the new text is present and the old inline-command wording is gone.
- [x] 3.2 Run `npm run check` and `openspec validate ts-023 --strict --no-interactive`, report the exact commands and their real output, and do not mark any earlier task complete if either fails.

## Manual acceptance

- In a real desktop and mobile browser, compare the overview and the detail view before and after: confirm the rows are noticeably denser, the parent/substep hierarchy and multiline notes stay readable, long titles and narrow widths do not overlap or overflow, and every interactive target is at least 44 × 44 px.
- Open the « ⋮ » menu on a top-level task and on a direct substep and confirm the applicable commands only: « Modifier » and « Retirer » everywhere, « Ajouter une sous-étape » on a parent, « Promouvoir en tâche principale » on a substep, « Garder le fil » (or the tracked state) on an unfinished parent, and no command duplicated on the row.
- Confirm « Monter » and « Descendre » are absent from the visible row but present in the menu, that they move exactly one rank inside the allowed same-subject / same-parent / same-priority group, that impossible directions are disabled, and that the drag handle still works with mouse, finger and stylus; confirm the project reorder arrows are untouched.
- Operate the menu with mouse, touch, Tab, Enter, Space and Escape; check `aria-expanded`, the accessible name « Actions pour [titre] », a visible focus indicator, focus return to the button after closing, one open menu at a time, and closing on outside click and on a view change.
- Confirm the priority selector keeps its three values, its real 44 × 44 px interactive area and does not open the menu or start a drag, and that the completion checkbox and the « Voir N sous-tâches » disclosure control stay directly usable.
- Check with a screen reader that the menu button, its expanded state and its commands are announced in French and that user titles are read as text.
- Confirm no localStorage write, no new storage key and no JSON V1 or route change occurs when opening or closing a menu, and that edit, remove, undo, notes, promotion, tracking and ordering behave exactly as before.
- These are pending human acceptance, not completed by any green Node test, and contain no checkbox.

## Post-sync review

- After the separate OPSX semantic sync step, compare the canonical deltas for `task-actions-menu` (ADDED), `task-hierarchy-presentation` (ADDED compact rows, MODIFIED controls), `action-editing`, `action-ordering`, `substep-ordering`, `resume-tracking` and `substep-promotion` (MODIFIED) against the intended behavior, including that no other requirement changed.
- Check the archived OpenSpec change and its versioned content.
- After the PR is published, verify the independent GitHub `check` job on the exact head SHA, the required branch protection, the merge evidence and post-merge CI / GitHub Pages deployment.
- This stage is external to `apply`; these reviews contain no checkbox and must never be marked complete before their evidence exists.
