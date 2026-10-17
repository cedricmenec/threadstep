# Proposal

## Why

From the overview, the only per-project number today is « N étape(s) en attente »,
which counts unfinished steps including substeps and shrinks as work is completed.
The user cannot tell how large a project really is, and after TS-017 the card shows
at most five entries, so the visible list no longer reflects the project volume.
TS-018 adds a separate, explicit total of top-level tasks to each project header.

## What Changes

- Add a pure, non-mutating total: the number of a subject's **top-level tasks**
  (`parentId: null`) in `subject.items`, including completed ones and excluding
  direct substeps.
- Show a French label in each overview project card header: « 0 tâche au total »,
  « 1 tâche au total » or « N tâches au total » (N > 1), rendered as a text node
  and perceptible without relying on colour.
- Keep the existing « N étape(s) en attente » counter exactly as delivered:
  same computation (all unfinished items, substeps included) and same wording.
  The total is displayed separately and does not replace it.
- Make the total independent of the « Masquer les étapes terminées » filter, the
  substep collapse state and the TS-017 five-entry preview limit; it recomputes
  from the complete `subject.items` on every render.
- Show the same total label in the detail view header for coherence, without
  changing navigation or the existing pending counter.
- Keep the change presentation-only: no new document field, version, storage key,
  preference, network call or dependency.
- **BREAKING**: none. No document, storage key, JSON shape or route change.
- Update the canonical specs and the product documentation (user guide, MVP),
  with deterministic Node tests for the pure count/label and static assertions
  for the header wiring.

## Capabilities

### New Capabilities

- `subject-task-total`: computes and displays, per subject, the total number of
  top-level tasks (completed included, substeps excluded) in the overview project
  card header, with correct French agreement, independent of filters, collapse and
  the overview preview limit, while the existing pending counter is preserved.

### Modified Capabilities

- `subject-detail-view`: adds a requirement that the detail view header also shows
  the same total label beside the existing unfinished-step count, without changing
  the pending count, the route or any navigation behavior.

## Impact

- `site/core.js`: add pure `totalTaskCount(items)` and a French-agreement label
  helper reusing the existing item shape; no change to existing domain functions.
- `site/app.js`: render the total line in the overview card header (`renderSubject`)
  and in the detail header (`renderDetailHead`); keep the pending line untouched.
- `site/styles.css`: minimal styling so the total is legible and wraps in mobile
  headers, without colour-only signalling.
- `tests/core.test.mjs`: deterministic cases for the pure count, label and
  invariance across filter, collapse, preview, import, removal, undo and reorder.
- `tests/task-total.test.mjs` (new): static assertions over `site/app.js` and
  `site/styles.css` for the header wiring, literal text rendering and pending
  counter preservation; these do not replace manual visual acceptance.
- `docs/product/guide-utilisation.md` and `docs/product/mvp.md`: describe the total
  header label (FR-21) and keep the pending counter wording accurate.
- Unchanged: document schema and version, `threadstep.document.v1`,
  `threadstep.resume.v1`, JSON shape, routes, dependencies, network, workflows,
  `AGENTS.md`, `backlog/` and `docs/factory/`.

## Non-Goals / Out of Scope

- Replacing, renaming or re-scoping the existing « étapes en attente » counter.
- Counting substeps in the total, or adding a distinct substep count.
- Historical statistics, charts, workload accounting, new business statuses or
  changes to tracking/suggestion rules.
- Any new data field, storage key, document version or migration.
- Touching the TS-017 preview quota, the detail route or navigation behavior.

## Unresolved Decisions / Uncertainties

- **Exact total label wording.** Planned: « N tâche(s) au total » with the French
  rule that 0 and 1 take the singular (« 0 tâche au total », « 1 tâche au total »)
  and only N > 1 takes the plural. Final wording and placement are review details.
- **Whether the detail header shows the total.** Planned: yes, one additional
  `small` line beside the existing pending count, for coherence with the card, as
  explicitly permitted by the backlog task. Removing it later is a presentation
  change with no data impact.
- **Substep count label.** Planned: not shown; the backlog task allows an optional
  distinct substep label but does not require it, so it is kept out of scope to
  avoid ambiguity about the main total.
- **Order of the two header lines.** Planned: the total line after the existing
  pending line, both as plain text nodes; the reading order is a review detail.
