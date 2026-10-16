# Proposal

## Why

The overview packs every subject, counter and control into dense cards. A person
juggling several subjects needs a roomier, dedicated view to read and work on one
subject's tasks and substeps, and a way to rename a subject without recreating
its steps. TS-016 adds a browser-only detail route and a targeted subject-title
rename, reusing the existing document and the existing task behaviors.

## What Changes

- Add a lightweight client-side route built on the URL fragment (no framework,
  no network request, no new data file) that opens exactly one subject in a
  dedicated view, identified only by its stable `id`.
- Add an explicit French « Ouvrir le projet » control in each overview subject
  card header that opens that subject and interferes with no other control,
  form or drag-and-drop.
- Show the subject title, its own unfinished-step count, and only its top-level
  tasks and direct substeps in a more spacious layout; other subjects are never
  rendered.
- Reuse the existing add / edit / complete / collapse / filter / reorder (within
  the allowed groups) / remove / undo functions and their validations, priority,
  parent, filter and ordering restrictions.
- Add a « Retour à la vue d'ensemble » control; browser Back/Forward and a reload
  of a valid detail route restore the correct view. An invalid route, or a
  subject id absent after import or removed meanwhile, shows an accessible
  fallback with a return control and creates or modifies nothing.
- Make opening, closing and switching views presentation-only: no localStorage
  write, no document change, no new persistent preference or storage key.
- Add « Renommer le projet » in the detail view with an explicit form and
  « Enregistrer » / « Annuler », reusing the subject-title validation (trimmed
  non-empty, 100 characters maximum). A valid rename changes only the targeted
  subject's `title`, preserving its `id`, items, `parentId`s, orders and
  priorities, persists in the existing V1 document, and is reflected in the
  overview and the JSON export.
- **BREAKING**: none.
- Update the canonical specs, the product guide/MVP and deterministic Node tests.

## Capabilities

### New Capabilities

- `subject-detail-view`: presents one subject's tasks and direct substeps in a
  roomier dedicated view reachable through a stable-id fragment route, with an
  accessible fallback and no data mutation on navigation.
- `subject-renaming`: renames an existing subject's title from the detail view
  with validation, a targeted update and preserved identity, hierarchy and
  storage.

### Modified Capabilities

None. The task and subject behaviors reused in the detail view are unchanged, so
`action-editing`, `action-ordering`, `action-removal`, `substep-collapse`,
`substep-ordering`, `next-action-suggestion` and `resume-tracking` keep their
existing requirements.

## Impact

- `site/core.js`: add pure helpers for route formatting/parsing, subject lookup
  and a targeted subject-title rename; no change to existing domain functions.
- `site/app.js`: add route state and hash navigation, factor a reusable task
  area from the subject card, render the detail view and fallback, and add the
  open/return/rename controls.
- `site/styles.css`: spacious detail layout, focus states and ≥ 44 × 44 px touch
  targets, respecting `prefers-reduced-motion`.
- `site/index.html`: reuse the existing `#subjects` region; no new persistent
  container or data file is required.
- `tests/core.test.mjs`: deterministic coverage for routing/ids, navigation
  without mutation, an absent subject, rename validations, JSON persistence and
  the absence of migration, plus a non-regression check of the task functions.
- `docs/product/guide-utilisation.md` and `docs/product/mvp.md`: new
  user-facing section and functional requirement.
- Unchanged: document schema and version, `threadstep.document.v1`,
  `threadstep.resume.v1`, JSON shape, dependencies, network, workflows,
  `AGENTS.md`, `backlog/` and `docs/factory/`.

## Non-Goals / Out of Scope

- Duplicating or copying a subject, including generating or remapping task or
  substep ids (abandoned feature).
- A new subject removal from the detail view; the overview « Supprimer le sujet »
  stays unchanged and the detail view only handles a vanished subject.
- Accounts, collaboration, cross-device sync, new business statuses, comments,
  due dates, extra nesting, JSON migration, Kanban, time tracking or factory
  changes.

## Unresolved Decisions / Uncertainties

- **Overview chrome shown in detail.** Planned default: hide the overview-scoped
  « Ajouter un sujet » form and the « Une étape pour maintenant » / « Je reprends
  ici » cards because they can expose another subject's title and the acceptance
  criterion requires that no other project appears in the detail view. Keep the
  global counter, the completed filter, the export/import toolbar and the undo
  snackbar, which are not tied to a single project card. This is a presentation
  choice only and can be adjusted during review without changing scope.
- **Exact route grammar and wording.** Planned: fragment `#/sujet/<encoded id>`
  for a subject and an empty or `#/` fragment for the overview; a fragment that
  names the subject route without a valid id is treated as invalid and shows the
  fallback. The final connector wording can be settled during review.
- **Exact detail layout.** Planned: render the detail into the existing
  `#subjects` region inside a `<section>` carrying the `.subject` class and
  `data-subject` so the existing drag target resolution and focus helpers keep
  working. The precise spacing is a review detail.
- **Reveal from global cards.** Planned: activating « Voir dans la liste » from
  the suggestion or tracking card first returns to the overview, so the existing
  reveal behavior stays coherent from either view.
