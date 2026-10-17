# Design

## Context

See `proposal.md` — Why, and `specs/task-hierarchy-presentation/spec.md` for the
requirements. ThreadStep keeps its domain logic in pure functions in
`site/core.js` and its DOM in `site/app.js`, with no browser test harness: UI
wiring is checked by static text assertions over `site/app.js` / `site/styles.css`
(see `tests/overview-preview.test.mjs`, `tests/task-total.test.mjs`).

The hierarchy is already encoded in the DOM but barely in the visuals:

- `renderItem` (`site/app.js:595-613`) builds one `li` per item with the class
  `"task" + (item.done ? " done" : "") + (revealItemId === item.id ? " reveal" :
  "")`, then, when a parent has visible substeps, appends a
  `ul.tasks.children` (`site/app.js:606-611`) containing the direct substeps.
- Top-level tasks and substeps therefore share the same `task` class; only the
  ancestor `.children` context distinguishes them.
- `renderTaskArea` (`site/app.js:553-591`) builds the `ul.tasks` for a subject and
  is used by both the overview (`renderSubject`, `site/app.js:499-545`) and the
  detail view (`renderDetailView`, `site/app.js:143-158`), so both views share
  `renderItem`.
- Existing hierarchy styling is minimal: `.children{padding-left:26px}` and
  `.children .task{margin-top:5px;padding-top:9px}` (`site/styles.css:100-101`),
  plus the detail overrides at `site/styles.css:124-127` and the mobile query at
  `site/styles.css:113`.
- Touch targets and focus already exist (`.priority-control`, `.task-toggle`,
  `.task-handle`, `.subject-open`, `button:focus-visible`,
  `site/styles.css:6,74,79,81,115-116`) and must be preserved.

Constraints: browser-only, French accessible UI, no new dependency, storage key,
route or data change, `site/core.js` logic untouched, and presentation must not
mutate the document. The item shape, order and counters are owned by existing
capabilities and MUST NOT move.

## Goals / Non-Goals

**Goals:**

- Make a top-level task and its direct substeps distinguishable by at least two
  non-colour-exclusive cues, identically in the overview and the detail view.
- Keep every requirement of the existing views intact: `ul/li` structure,
  `done`/`reveal` classes, controls, accessible names, focus, 44 × 44 px targets,
  priority and completion semantics, reduced motion and contrast.
- Keep the change provable with static assertions and non-regression tests, since
  no DOM harness exists.

**Non-Goals:**

- A DOM test harness, a framework, a new dependency, a build step or new assets.
- Changing `site/core.js` logic, the item shape, order, counters, routes, storage
  or the JSON export.
- New nesting levels, a Kanban board, theme customisation or colour-only cues.
- Replacing the semantic priority/completion colours or the existing controls.

## Decisions

1. **Add two structural classes in `renderItem`, keep everything else.**
   - Compute `const level = item.parentId === null ? "task-parent" :
     "task-substep"` and build the `li` class as `"task " + level + (item.done ?
     " done" : "") + (revealItemId === item.id ? " reveal" : "")`.
   - The `ul.tasks.children` nesting, the `list.id`/`aria-controls` link, the
     editor/row/note/actions composition and every `el(...)` text node are left
     untouched.
   - **Rationale:** explicit classes let both views target the parent and the
     substep directly and let a static test assert the level without relying on
     an ancestor selector, while the existing `.children` selectors keep working
     unchanged. Alternatives rejected: only `.children` descendant selectors
     (works but is harder to assert and to target the top-level row
     independently) and `data-*` attributes (the codebase styles via classes).

2. **Two independent non-colour cues: indentation/spacing plus a structural
   guide, reinforced by typographic scale.**
   - Substeps get a responsive `padding-left`/`margin-left` (indentation and
     space), a visible left nesting guide through a `border-left` (or a
     pseudo-element rule) on the `.tasks.children` list, and a slightly smaller,
     denser title (`font-size`/`line-height`) than a top-level task.
   - The guide is a structural line, not a colour signal; indentation and the
     typographic scale carry the hierarchy even if the guide's colour is
     indistinguishable. At least two of these cues are always present.
   - **Rationale:** matches the product brief (indentation, hierarchy guide,
     adapted density and typography) and the "at least two non-colour cues" rule,
     without adding a textual marker to every line. Alternatives rejected: a
     colour-only left border (fails the non-colour rule) and a glyph prefix
     (extra noise, and a decorative marker is not desired).

3. **Top-level identity through grouping and separation, not new structure.**
   - `.task-parent` gets extra vertical separation from its child list and its
     command zone (` .task-actions`) visually grouped with the row (existing
     `margin-left:21px` on `.task-actions`, `site/styles.css:77`, is kept), so the
     parent row, its note and its controls read as one unit above the indented
     children.
   - Existing `.subject`/`.detail` card visuals, priorities and completion
     colours are not changed.
   - **Rationale:** the top-level card/row separation plus the substep
     indentation/guide directly supports "at least two cues" and keeps the
     parent clearly primary. Alternatives rejected: a redrawn card for every
     parent (heavier than needed) and removing the card background (would reduce
     contrast and grouping).

4. **Responsive rules extend the existing mobile query.**
   - The substep indentation and guide shrink in `@media(max-width:620px)` so a
     parent, its substeps and their controls fit without horizontal overflow; the
     parent/child contrast stays visible.
   - No new media query is required beyond the existing one at
     `site/styles.css:113`.
   - **Rationale:** reuses the current responsive strategy and avoids layout
     surprises. Alternatives rejected: fixed large indentation (overflows on
     phones) and hiding the guide on mobile (would drop below two cues).

5. **Preserve accessibility by construction.**
   - Only classes and CSS are added. `li`/`ul`, `aria-label`, `aria-expanded`,
     `aria-controls`, `aria-grabbed`(drag only), the 44 × 44 px targets, the
     `button:focus-visible` outline and the `prefers-reduced-motion` transitions
     are left byte-identical where they exist; new cues are non-focusable,
     non-interactive presentation only.
   - **Rationale:** the hierarchy must not compete with the controls or the
     priority/completion semantics. Alternatives rejected: wrapping rows in new
     focusable elements (would change the tab order and accessible names).

6. **Presentation-only, no persistence.**
   - The level is derived from `item.parentId` during render; no data is written
     and `renderItem` never calls `persist()`. `site/core.js` is not changed.
   - **Rationale:** keeps the change a pure read of `documentState`, matching the
     product constraint that presentation and data stay separate.

7. **Static assertions plus non-regression tests, no browser needed.**
   - A new `tests/task-hierarchy.test.mjs` reads `site/app.js` and
     `site/styles.css` as text and asserts: `renderItem` builds `task-parent` /
     `task-substep` from `item.parentId === null`; the `done` and `reveal`
     composition is still present; the `ul` `"tasks children"` nesting, the
     `substepView` call and the in-order `view.children` iteration are unchanged;
     `.children`/`.task-substep` styling carries indentation/spacing and a
     structural guide; a mobile rule exists; no `innerHTML` is used. It also adds
     deterministic non-regression cases importing the unchanged core helpers
     (`substepView`, `visibleItems`, `overviewPreview`) to assert stored parent
     order is preserved and inputs are not mutated.
   - **Rationale:** matches the existing no-browser test pattern; static
     assertions complement, but never replace, the manual visual acceptance
     recorded without checkboxes in `tasks.md`.

## Risks / Trade-offs

- **Hierarchy read as colour-only.** → The design requires indentation/spacing
  and a structural guide plus typographic scale, so at least two non-colour cues
  are always present; a static test asserts the guide and the indentation rules
  exist.
- **`done`/`reveal` class composition regresses.** → The class expression keeps
  the existing suffixes; a static test asserts `done` and `reveal` remain part of
  the composition.
- **`ul/li` structure or parent association changes.** → Only classes are added;
  a static test asserts the child `ul` remains `"tasks children"` and the
  `substepView`/`view.children` iteration is unchanged, and the existing
  `substepView` non-mutation tests keep running.
- **Touch targets shrink or controls move.** → No control rule is edited; a
  static test asserts the existing 44 × 44 px rules and the focus outline remain.
- **Horizontal overflow on mobile.** → The indentation/guide shrink in the
  existing `@media(max-width:620px)` query; the residual risk is visual and is
  recorded for manual acceptance.
- **Static tests mistaken for visual acceptance.** → The `Manual acceptance`
  section of `tasks.md` records the remaining visual/touch checks without
  checkboxes; no automated assertion is presented as user validation.
- **`core.js` accidentally touched.** → The design routes all work through
  `renderItem` classes and CSS; any need to change `core.js` is treated as a
  scope escalation to requalify rather than a routine edit.

## Migration Plan

None. No schema, version, storage-key, route or export/import change is made.
Rollback removes the two classes, the `.task-parent`/`.task-substep` rules and
the new test file; every stored document and export stays valid and the previous
presentation is restored.

## Open Questions

None that change the specs, the approach or the task breakdown. The exact
indentation values, guide token, typographic scale, class names and whether to
add a decorative marker are recorded as uncertainties in `proposal.md` and are
safe to confirm during review.
