# Tasks

## 1. Structural level classes in `site/app.js`

- [x] 1.1 In `renderItem`, derive the item level from `item.parentId === null`
  and build the `li` class as `"task " + level + (item.done ? " done" : "") +
  (revealItemId === item.id ? " reveal" : "")`, with `level` equal to
  `"task-parent"` for a top-level task and `"task-substep"` for a direct substep,
  leaving the `ul.tasks.children` nesting, the list `id`, every control, every
  accessible name and every text node unchanged and adding no `persist()` call;
  verify with `node --check site/app.js`.
- [x] 1.2 Create `tests/task-hierarchy.test.mjs` reading `site/app.js` as text
  and asserting that the classes come from `item.parentId === null`, that
  `"task-parent"` and `"task-substep"` are both produced, that the existing
  `done` and `reveal` composition is still present, that the child list is still
  built as `el("ul", "tasks children")`, that `renderItem` still calls
  `substepView` and iterates `view.children` in order without sorting, and that
  no `.innerHTML` is used; verify with `npm test`.

## 2. Hierarchical styles in `site/styles.css`

- [x] 2.1 Add the hierarchy cues in `site/styles.css`: indentation and spacing
  and a structural nesting guide (a `border-left` rule or an equivalent
  non-interactive pseudo-element) on the substep list/rows, plus a smaller,
  denser substep typography, and extra vertical separation for `.task-parent`
  that groups its row, note and command area above the indented children; use
  shape/space/scale so at least two cues do not depend on colour, and do not
  edit the existing priority, completion, focus, touch-target or
  `prefers-reduced-motion` rules; verify with the static assertions in task 2.3.
- [x] 2.2 Extend the existing `@media(max-width:620px)` query so the substep
  indentation and guide shrink and the parent/child contrast stays visible
  without horizontal overflow, adding no new media query; verify with the static
  assertion in task 2.3 and record the residual visual check for manual
  acceptance.
- [x] 2.3 Extend `tests/task-hierarchy.test.mjs` with static assertions that
  `.task-substep`/`.children` carry indentation or spacing and a structural
  guide, that a typographic scale cue exists, that `.task-parent` gets separation,
  that the mobile query adjusts the hierarchy, and that the existing
  `button:focus-visible`, 44 × 44 px target and `prefers-reduced-motion` rules are
  still present; verify with `npm test`.

## 3. Non-regression tests: hierarchy states, order and no mutation

- [x] 3.1 Add deterministic cases to `tests/task-hierarchy.test.mjs` importing
  the unchanged core helpers (`substepView`, `visibleItems`, `overviewPreview`)
  and asserting that a parent's direct substeps keep their stored array order
  under the default, completed-filtered and collapsed paths, that a completed
  parent with an unfinished substep stays visible when completed steps are
  hidden, and that the input item array and collapse set are not mutated; verify
  with `npm test`.
- [x] 3.2 Add static assertions to `tests/task-hierarchy.test.mjs` that the
  done, filtered and collapsed render path is unchanged: the `done` class is
  driven by `item.done`, the child list is produced only from `substepView`'s
  `renderChildren`/`children`, its `id` is `substepListId(item.id)` and the
  `aria-controls` link is preserved; verify with `npm test`.

## 4. Product documentation

- [x] 4.1 Update `docs/product/guide-utilisation.md` with a short section
  describing the visual hierarchy of tasks and substeps (indentation, structural
  guide, adapted typography, identical in both views, preserved controls, focus
  and mobile legibility); confirm the text matches the shipped behavior and that
  `npm run check` still passes.
- [x] 4.2 Update `docs/product/mvp.md` to turn the planned FR-23 (TS-020) into a
  delivered requirement and add its matching acceptance test (two non-colour
  cues in both views, preserved `ul/li`, controls, focus, touch targets, priority
  and completion semantics, no data or rule change); confirm the text matches the
  shipped behavior and that `npm run check` still passes.

## 5. Integration verification

- [x] 5.1 Run `npm run check` and report the exact command and its output.
- [x] 5.2 Run `openspec validate ts-020 --strict --no-interactive` and report the
  exact command and its output.

## Post-sync review

- After the OpenCode OPSX sync, diff the new canonical
  `openspec/specs/task-hierarchy-presentation/spec.md` against this change's
  delta and confirm the `## Purpose`, every requirement and every scenario were
  copied without loss, duplication or rewording, and that the strict
  description-length check passes.
- Confirm every existing canonical spec under `openspec/specs/` is byte-identical
  to its prior revision, since this change adds exactly one capability and
  modifies no existing capability.
- Verify the OPSX content-scope guard, the OpenSpec archive step and the
  independent PR CI `check`; a reviewer must approve the semantic diff before
  merge. These assertions cannot be ticked by apply before the sync has run.

## Manual acceptance

- On a real browser on desktop and at usual mobile widths, compare the overview
  and the detail view for top-level tasks and their direct substeps in the
  default, completed, filtered and collapsed states; judge the hierarchy from
  non-chromatic cues alone (ignore colours and priority badges) and check for
  contrast, clipping and horizontal overflow.
- Traverse the interface with keyboard, touch and mouse: confirm visible focus,
  reachable ≥ 44 × 44 px controls, usable drag and its move-control alternative,
  and collapse/expand; use a screen reader if possible to confirm the `ul/li`
  association and accessible names are unchanged.
- Check the standalone PR results, Pages, the post-sync spec coherence and the
  post-merge behavior. No claim recorded here counts as validation until it has
  actually been run.

## Workflow follow-up

- Do not archive during implementation; sync, semantically verify and archive
  only through the project's reviewed process after every tracked task is checked
  and strict validation passes.
- Keep `site/core.js` logic untouched; if a hierarchy change appears to require a
  core or data change, stop and requalify the risk instead of editing it.
- Confirm no protected path changed and that independent CI passes before merge.
- This plan authorizes no paid model run, no apply, no merge and no archive.
