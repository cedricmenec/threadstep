# Design

## Context

See `proposal.md` — Why. Each overview card is built by `renderSubject`
(`site/app.js:498-543`), which puts the subject title and the existing
`pending + " étape(s) en attente"` line into a `titleBox` (`site/app.js:504-508`)
before the task area. The detail view uses `renderDetailHead`
(`site/app.js:173-193`) with the same pending computation (`site/app.js:180-181`).
Both read the live `subject.items` on every `render()` (`site/app.js:99-122`), so
any derived count is automatically recomputed after add, remove, undo, import,
priority change and reorder.

Domain logic lives in pure functions in `site/core.js` and is covered by Node
tests (`tests/core.test.mjs`); there is no DOM test harness, so UI wiring is
checked by static text assertions over `site/app.js` / `site/styles.css`
(see `tests/overview-preview.test.mjs`). Constraints: browser-only, no new
dependency or storage key, French accessible UI, presentation must not mutate the
document, and the pending counter must keep its current semantics.

The relevant existing pure helpers are `pendingCount(document)`
(`site/core.js:177-180`), which counts **all** unfinished items including
substeps, and the per-subject inline pending computation in `app.js`. TS-017
already added `overviewPreview`/`isWithinOverviewPreview` (`site/core.js:98-106`).

## Goals / Non-Goals

**Goals:**

- A pure, non-mutating `totalTaskCount(items)` that counts only `parentId: null`
  items, plus a French-agreement label helper, both unit-testable.
- One extra `small` header line per overview card and per detail header, leaving
  the existing pending line and its wording untouched.
- Provable invariance of the total across the completion filter, the collapse
  state, the TS-017 preview limit, import, removal, undo and reorder.
- Static coverage of the rendering wiring, since no DOM harness exists.

**Non-Goals:**

- Changing the pending counter, the preview selector, the detail route, the
  document schema or any business function.
- A DOM test harness, a framework, new persistence or a substep count.

## Decisions

1. **Pure count in `site/core.js`.**
   - `totalTaskCount(items)` returns `Array.isArray(items) ? items.filter((item)
     => item && item.parentId === null).length : 0`. It reads the existing item
     shape only, never sorts, filters by completion or mutates.
   - **Rationale:** the total is a property of the complete item list, so a direct
     filter over `parentId: null` is the simplest correct definition and is
     trivially invariant to presentation state. Alternatives rejected: reusing
     `visibleItems` (applies the completion filter and would make the total depend
     on presentation state) and `pendingCount` (counts substeps and ignores
     completed items).

2. **Pure French-agreement label in `site/core.js`.**
   - `totalTaskCountLabel(count)` returns `count + " tâche" + (count > 1 ? "s" :
     "") + " au total"`, normalizing a non-finite or negative input to `0`.
   - **Rationale:** mirrors the existing `substepToggleLabel` pattern and makes the
     agreement cases (0/1 singular, N > 1 plural) deterministic and testable
     without a DOM. Alternatives rejected: formatting inside `app.js` (not
     unit-testable) and a separate count of substeps (out of scope).

3. **One extra header line, pending line untouched.**
   - In `renderSubject`, after the existing pending line, append
     `el("p", "small subject-total", totalTaskCountLabel(totalTaskCount(subject.items)))`.
     The existing pending line (`site/app.js:507-508`) is left byte-identical.
   - In `renderDetailHead`, append the same line to `titleBox` after the existing
     pending line, so the detail header shows both counts and the detail route and
     controls are unchanged.
   - **Rationale:** both views already share the same render path and document, so
     the total stays coherent everywhere. Alternatives rejected: overview-only
     (less coherent, and the task explicitly permits the detail label) and
     replacing the pending line (would break the existing counter contract).

4. **Presentation-only, no persistence.**
   - Both helpers are called only while building DOM nodes in `render()`; no
     `persist()` call, no `localStorage`, no new field or key is added on any
     count path.
   - **Rationale:** keeps the change a pure read of `documentState`, matching the
     product constraint that presentation and data stay separate.

5. **Styles and static coverage.**
   - `.subject-total` reuses the `.small` look with `overflow-wrap:anywhere` (or an
     equivalent existing wrap rule) so a long label wraps in a narrow header; no
     colour-only signalling and no animation.
   - `tests/core.test.mjs` covers 0/1/many, substeps excluded, completed included,
     label agreement, and invariance across `visibleItems`/`overviewPreview`,
     import roundtrip, `planRemoval`/`restoreRemoval` and `reorderWithinPriority`.
     A new `tests/task-total.test.mjs` reads `site/app.js` and `site/styles.css`
     as text and asserts the two header calls, the untouched pending line and the
     wrap rule. Static assertions complement, but do not replace, manual visual
     acceptance.
   - **Rationale:** matches the existing no-DOM test pattern; pure tests carry the
     behavioral guarantees.

## Risks / Trade-offs

- **Total accidentally counts substeps.** → `totalTaskCount` filters strictly on
  `parentId === null`; a dedicated test asserts a parent with substeps counts once.
- **Pending counter regresses.** → The pending line is not edited; a static test
  asserts the exact existing string is still present and a pure test keeps
  `pendingCount` semantics.
- **Total varies with the filter or preview.** → The total is computed from the
  full `subject.items`, never from `visibleItems`/`overviewPreview`; invariance is
  asserted in tests.
- **Header crowding on mobile.** → One extra `small` line plus a wrap rule; the
  responsive `@media(max-width:620px)` header already wraps. Visual verification
  remains in the manual acceptance section.
- **Static tests mistaken for acceptance.** → The manual acceptance section of
  `tasks.md` records the remaining visual/mobile checks without checkboxes; no
  automated assertion is presented as user validation.

## Migration Plan

None. No schema, version, storage-key, route or export/import change is made.
Rollback removes the two header lines and the two pure helpers and leaves every
stored document and export valid.

## Open Questions

None that change the specs, the approach or the task breakdown. The exact label
wording, the detail-header placement and the line order are recorded as
uncertainties in `proposal.md` and are safe to confirm during review.
