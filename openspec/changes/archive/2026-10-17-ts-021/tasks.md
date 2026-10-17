# Tasks

## 1. Core collapse model (default collapsed)

- [x] 1.1 Change `site/core.js` so `substepView(items, parentId, hideCompleted, expandedIds)` treats a parent as collapsed unless its id is in the expanded set, replacing `toggleCollapsedParent` with `toggleExpandedParent`, and add `substepAncestorId(items, itemId)` plus `isViewEntry(previousRoute, nextRoute)`; verify with deterministic Node unit tests in `tests/core.test.mjs`.
- [x] 1.2 Add deterministic Node tests to `tests/core.test.mjs` covering the empty expanded set rendering all parents collapsed, per-parent toggle independence, completion-filter counts, `substepAncestorId` for a substep/top-level/missing id, `isViewEntry` for same-view and changed-view routes, and non-mutation of `items` and the expanded set; run `node --test tests/core.test.mjs` and report the result.

## 2. App state and view transitions

- [x] 2.1 Replace `collapsedParents` with an empty `expandedParents` set in `site/app.js` and update `renderItem`/`renderSubstepToggle` to the expanded-set API; verify with a Node static-assertion test that reads `site/app.js` and with `node --check site/app.js`.
- [x] 2.2 Reset `expandedParents` only when the parsed route changes in the `hashchange` handler, and also on `load()` and successful import, while leaving same-route `navigate()` and ordinary re-renders untouched; verify with deterministic Node assertions over the route-transition helper logic and static assertions on `site/app.js`.
- [x] 2.3 Ensure a parent that first receives a substep stays collapsed and that an explicit reveal of a hidden substep temporarily adds its ancestor to `expandedParents` before render; verify with Node unit/static tests over `substepAncestorId` usage and the reveal path.
- [x] 2.4 Add the deterministic app-wiring test to the `tests/` suite (default `expandedParents`, route-change reset, reveal ancestor call, no `.innerHTML`) and run `node --test tests/*.test.mjs`; report the result.

## 3. Documentation and final gate

- [x] 3.1 Update `docs/product/mvp.md` FR-16 and `docs/product/guide-utilisation.md` to state that substeps start collapsed and reset on each view entry; verify with a deterministic test or grep assertion that the old "start expanded" default is no longer documented.
- [x] 3.2 Run `npm run check` and `openspec validate ts-021 --strict --no-interactive`, report the exact commands and their real output, and do not mark any earlier task complete if either fails.

## Manual acceptance

- In a real desktop and mobile browser, load the overview and a direct `#/sujet/<id>` URL and confirm every parent with visible substeps starts collapsed, with title, optional note, priority, completion checkbox and commands still readable.
- Navigate overview → detail → overview, detail A → detail B, and use browser Back/Forward; confirm each newly displayed view starts all collapsed even after expanding a parent in the previous view, while editing, changing priority, toggling completion, changing the filter, reordering and notifications keep a voluntary expansion.
- Operate the disclosure control with mouse, touch, Tab, Enter and Space; confirm visible focus, the exact « Voir 1 sous-tâche » / « Voir N sous-tâches » / « Masquer les sous-tâches » labels, exact `aria-expanded`, `aria-controls` when the list exists, no focusable descendant while collapsed and no control when no substep is visible.
- Test with a screen reader that collapsed substeps are absent from the accessible tree and that parents and their notes remain announced.
- Add a first substep to a childless parent and confirm it starts collapsed; use « Voir dans la liste » on a target hidden behind a collapsed ancestor and confirm the ancestor opens temporarily, the target is revealed and focused, and leaving the view collapses it again.
- Confirm no localStorage write, no new key and no JSON V1 field change is caused by collapsing, expanding, navigating or revealing, and that the exported JSON is identical before/after.
- These are pending human acceptance, not completed by any green Node test, and contain no checkbox.

## Post-sync review

- After the separate OPSX semantic sync step, compare the canonical deltas for `substep-collapse` and `subject-overview-preview` against the intended MODIFIED/ADDED behavior.
- Check the archived OpenSpec change and its versioned content.
- After the PR is published, verify the independent GitHub `check` job on the exact head SHA, the required branch protection, the merge evidence and post-merge CI / GitHub Pages deployment.
- This stage is external to `apply`; these reviews contain no checkbox and must never be marked complete before their evidence exists.
