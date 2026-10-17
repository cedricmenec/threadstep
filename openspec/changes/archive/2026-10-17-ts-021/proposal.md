# Proposal

## Why

The overview and the detail view render every substep expanded on first display,
so a subject with many children looks overloaded before the user has chosen what
to open. Starting each visit with substeps collapsed (TS-021) keeps the parent
titles, notes, priorities and controls readable while preserving the existing
explicit « Voir N sous-tâches » / « Masquer les sous-tâches » control.

## What Changes

- **Default collapsed**: at document load, on a direct `#/sujet/<id>` entry, and
  on every entry into a view, every top-level task with at least one visible
  substep starts collapsed. This generalizes FR-16, which currently specifies
  that substeps start expanded after a reload, a new tab and an import.
- **Reset on view navigation**: moving between views (overview → detail,
  detail → overview, detail A → detail B) by internal navigation or browser
  Back/Forward resets the collapse state to all-collapsed, even if a parent was
  expanded in the previous view. Ordinary re-renders of the current view
  (edit, priority, completion, filter, reorder, notification) keep voluntary
  expansions.
- **New child stays collapsed**: a top-level task that had no visible substep
  remains collapsed on the render that first shows an added substep. An already
  expanded parent keeps its voluntary expansion when a child is added.
- **Temporary reveal**: an explicit reveal (« Voir dans la liste », removal
  undo) that targets a direct substep of a collapsed parent expands that
  ancestor for the reveal, shows and focuses the target, and never persists the
  expansion.
- Existing disclosure semantics are unchanged: labels « Voir 1 sous-tâche » /
  « Voir N sous-tâches » / « Masquer les sous-tâches », current-filter counts,
  exact `aria-expanded`, `aria-controls` when the list exists, no focusable
  descendant while collapsed and no control when no substep is visible.
- **No persistence**: the open/closed state stays in page memory only. No new
  JSON V1 field, no storage key and no localStorage write is caused by
  collapsing, expanding, navigating or revealing.

### Non-goals

- A global « tout ouvrir » button.
- Remembering expansion between visits or across reload (the opposite is
  required).
- A second nesting level, or any change to `threadstep.document.v1`.
- Changing the five-entry overview preview, counters, ordering, notes,
  « Je reprends ici », the suggestion or any other business rule.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `substep-collapse`: the transient state now defaults to collapsed on load and
  direct detail entry, resets on each view entry, keeps a newly added child's
  parent collapsed, and allows a temporary non-persisted ancestor expansion for
  an explicit reveal.
- `subject-overview-preview`: the « Substeps do not consume a slot » scenario is
  updated because previewed substeps are no longer rendered by default; they
  still count as one entry whether the parent is collapsed or expanded.

## Impact

- `site/core.js`: collapse view helper semantics (expanded-set model) and a
  small ancestor lookup helper for reveals; existing pure functions updated.
- `site/app.js`: expanded-parents state, route-transition reset, reveal
  ancestor handling. No route, storage or document schema change.
- `tests/core.test.mjs` and existing static assertions in
  `tests/task-hierarchy.test.mjs` / `tests/overview-preview.test.mjs`, plus a
  new deterministic test for the default-collapsed and navigation-reset wiring.
- `docs/product/mvp.md` (FR-16) and `docs/product/guide-utilisation.md` are
  updated in the same PR to state the new default.

## Uncertainties

- No `/dev` decision is needed for the same-route internal `navigate()` case:
  this proposal treats only a *change* of parsed route as a view entry, because
  the selected task says ordinary re-renders must preserve voluntary openings.
- Whether the product owner wants the collapsed default also documented as the
  long-term FR-16 behavior is treated as in scope for the product docs update;
  no new persisted preference is introduced either way.
