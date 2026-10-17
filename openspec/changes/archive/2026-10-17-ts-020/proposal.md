# Proposal

## Why

In both the overview and the detail view, a top-level task and its direct
substeps are today rendered by the same `renderItem` path: the same `li.task`
styling with a modest `.children` indent (`site/app.js:595-613`,
`site/styles.css:100-101`). A user cannot tell a parent from its children at a
glance, especially when tasks are completed, filtered or a parent is collapsed,
and the hierarchy can be confused with the priority badges. TS-020 makes the
parent/child relationship visually obvious while keeping ThreadStep deliberately
minimal. User value: know immediately which line is a main task and which lines
belong to it, in both views and on mobile.

## What Changes

- Give **top-level tasks** a clearer primary identity: coherent card spacing plus
  a background or border that groups the row, its note and its command area, and
  a hierarchised title. Distinguish the command zone from the title.
- Give **direct substeps** a clearly secondary but readable treatment: responsive
  indentation, a structural hierarchy guide (a visible nesting rule) and adapted
  density and typographic scale. The nesting MUST NOT be signalled by colour, the
  priority-badge nuance or the completion state alone.
- Signal the hierarchy with **at least two non-chromatically-exclusive cues**
  (indentation/spacing, a structural guide line, typographic scale) in the
  overview **and** in the detail view.
- Apply the same hierarchy in both views, including completed tasks, a filtered
  list and collapsed substeps. Top-level tasks stay `li` elements and substeps
  stay a `ul` child of the correct parent `li`, with assistive-technology and
  keyboard behaviour preserved.
- Preserve the semantic priority (`priority-<value>`) and completion colours,
  visible focus, small-screen legibility, `prefers-reduced-motion` and the
  existing theme contrast. Edit, add, reorder, collapse and undo controls stay
  findable and keep ≥ 44 × 44 px touch targets.
- Presentation only: no change to data, ordering rules, priorities, counters,
  routes, storage or export. `site/core.js` logic is untouched and no library or
  image is added.
- **BREAKING**: none. No document, storage-key, JSON-shape or route change.

## Capabilities

### New Capabilities

- `task-hierarchy-presentation`: the observable presentation contract that makes
  a top-level task and its direct substeps distinguishable by at least two
  non-colour-exclusive cues, identically in the overview and the detail view,
  across completed, filtered and collapsed states, while preserving semantic
  `ul/li` structure, accessible names, focus, controls, touch targets, priority
  and completion semantics, reduced motion, and leaving all data and business
  rules unchanged.

### Modified Capabilities

- None. No existing capability's requirements change; this change adds a
  presentation capability that applies to the existing views without altering
  their behavior.

## Impact

- `site/app.js`: minimal structural classes computed in `renderItem` so a
  top-level task and a substep are selectable in both views; the `done` and
  `reveal` classes, the child `ul.children` nesting, every control and every
  accessible name are preserved. No `persist()` and no logic change.
- `site/styles.css`: the hierarchy cues (indentation, structural guide, density,
  typographic scale, top-level card separation) plus a responsive rule for narrow
  viewports; existing focus-visible, 44 × 44 px targets and
  `prefers-reduced-motion` rules are kept.
- `tests/task-hierarchy.test.mjs` (new): static assertions over `site/app.js` and
  `site/styles.css` for the structural classes, the two non-colour cues, the
  preserved `done`/`reveal` composition, the `ul/li` nesting and the mobile rule;
  deterministic non-regression cases for parent order and absence of mutation,
  reusing the unchanged core helpers. These complement, and never replace, the
  manual visual acceptance.
- `docs/product/guide-utilisation.md` and `docs/product/mvp.md`: document the
  visual hierarchy (FR-23, TS-020).
- Unchanged: `site/core.js` logic, document version, `threadstep.document.v1`,
  `threadstep.resume.v1`, routes, dependencies, network, workflows, `AGENTS.md`,
  `backlog/` and `docs/factory/`.

## Non-Goals / Out of Scope

- New substep nesting levels, a Kanban board, theme customisation or a redesign
  of the document model.
- Changing priority rules, ordering rules, counters, completion semantics,
  routes, storage keys or the JSON export/import shape.
- Replacing the semantic priority/completion colours, removing the existing
  controls or their accessible names, or introducing colour-only signalling.
- Adding a library, an image, an icon font or a build step.
- Desktop-only treatment: the hierarchy must remain legible and non-overflowing
  on usual mobile widths.

## Unresolved Decisions / Uncertainties

- **Exact visual cues.** Planned: indentation plus a structural left guide on the
  substep list, plus a smaller/denser substep typography and a subtle top-level
  row separation. The precise pixel values, guide colour token and title scale
  are review details that do not change observable guarantees.
- **Structural marker text.** Planned: none. The hierarchy relies on space,
  guide and typography rather than adding a glyph to every line. Whether a
  decorative marker is added later is a presentation detail.
- **Explicit class names.** Planned: `task-parent` (top-level) and
  `task-substep` (direct substep) added beside the existing `task`, `done` and
  `reveal` classes, while the existing `.children` descendant selectors keep
  working. The final names are a review detail.
- **Whether existing capabilities should be modified.** Planned: no; the new
  presentation capability applies to both views without changing their
  requirement text, to avoid an untested MODIFIED operation. This is a review
  detail and does not affect the data or the business rules.
