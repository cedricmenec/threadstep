# Proposal

## Why

A step first captured as a substep can turn out to be autonomous. Today the only
way to promote it is to retype it as a new top-level task, which loses its `id`,
its note and its local identity. TS-022 adds an explicit, immediate promotion
that only changes the parent relation while preserving the whole item and the
integrity of the other children.

## What Changes

- **Promotion command**: every direct substep exposes a French
  « Promouvoir en tâche principale » control in the overview and in the detail
  view. It is never offered on a top-level task, and no second substep level is
  created.
- **Minimal mutation**: activation sets only the targeted item's `parentId` to
  `null` in its same subject. `id`, `title`, `priority`, `done`, the optional
  `note` and every other valid field are preserved; no object is recreated, no
  new `id` is generated, no sibling is re-parented, duplicated, moved or deleted.
- **Deterministic position**: the promoted item is inserted in `subject.items`
  immediately after its former parent without changing the relative order of the
  other elements. Rendering keeps the primary Urgent / Normal / Plus tard order
  then the manual order inside each group, and promotion changes no priority.
- **Single write and refusals**: a valid promotion causes exactly one local save;
  an unknown `id`, an already top-level item or a missing/incoherent parent is
  refused without writing, and a finished promotion does not replay.
- **Immediate coherence**: lists, the top-level task total (+1), the pending
  counter (unchanged), the overview five-entry preview, the completed filter,
  « Je reprends ici » and « Une étape pour maintenant » reflect the new
  hierarchy. A promoted unfinished task becomes eligible for the top-level-only
  functions, and removing the former parent keeps the promoted task.
- **Accessible focus**: the control is keyboard-, mouse- and touch-operable with
  an explicit French name, and the promoted task keeps an accessible focus or
  marker, opening the detail view when it falls outside the overview preview.
- **No data-format change**: JSON V1 export/import, the
  `threadstep.document.v1` storage key and the existing removal/undo, edit, note
  and reorder rules keep working with no version bump, new key or migration.

### Non-goals

- Moving a task or substep to another subject or project.
- Promoting a whole group, re-parenting the former siblings, or creating more
  than one substep level.
- An inverse « rétrograder » control, a confirmation modal, a batch mode, or any
  change to priorities or to a new business status.

## Capabilities

### New Capabilities

- `substep-promotion`: promoting one direct substep to a top-level task in the
  same subject, preserving its identity and fields, with deterministic ordering,
  single-save semantics and immediate coherence with the existing features.

### Modified Capabilities

- `substep-ordering`: the « No re-parenting or level change » requirement is
  clarified so that reordering still never changes a level, while the new
  explicit promotion command is the only sanctioned level change. The
  requirement text is copied whole and only clarified; no reorder behavior
  changes.

## Impact

- `site/core.js`: a new pure, immutable promotion function and a companion
  predicate, reusing the existing document and item shapes.
- `site/app.js`: the promotion control rendered for direct substeps in both
  view paths and its single-save/reveal wiring. No route, storage or schema
  change.
- `tests/core.test.mjs` and new deterministic assertions in `tests/`: promotion
  invariants, cross-feature coherence (total, pending, suggestion, preview,
  removal, import round-trip) and app-wiring static checks.
- `docs/product/mvp.md` (FR-17 parentage rule) and
  `docs/product/guide-utilisation.md` are updated in the same apply PR to
  describe the new explicit promotion, since the current FR-17 wording states
  that no item is re-parented or promoted. This planning change does not edit
  those files.

## Uncertainties

- **Focus when the promoted task is hidden by the completed filter**: if a
  completed substep is promoted while « Masquer les étapes terminées » is active,
  no rendered element exists to focus. The proposal keeps the operation valid and
  persisted and reports that, in this specific combination, no DOM element is
  targeted until the filter is cleared. This is reported rather than resolved to
  avoid inventing a product rule.
- **Ordering across different priorities**: the backlog requires insertion
  « immédiatement après son ancien parent » while rendering still groups by
  priority. The change stores the array position after the former parent and
  lets the existing stable priority sort decide the visual order; no product
  decision is added beyond the backlog text.
- **Reachability inside a collapsed parent**: a collapsed parent renders no
  substep DOM, so the promotion command is reachable only once the substeps are
  shown, exactly like the existing substep controls. No new behavior is assumed.
