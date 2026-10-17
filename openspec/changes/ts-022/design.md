# Design

## Context

See `proposal.md` — Why. The V1 document is `{ version: 1, subjects: [ { id,
title, items: [ { id, title, priority, done, parentId, note? } ] } ] }`.
`parentId: null` marks a top-level task; a non-null `parentId` points at a
top-level item and is the only nesting level allowed by `parseDocument`.
Rendering lives in `site/app.js`: `visibleItems`/`sortedItems` filter by
`parentId` and sort stably by priority (`urgent → normal → later`), so the array
order inside a priority group is the manual order. `renderActions` already
switches on `item.parentId === null` to offer the top-level-only controls
(« + Sous-étape », « Garder le fil »). The reveal/focus machinery
(`revealAction`, `focusItemId`, `revealItemId`) already handles an item that is
outside the overview five-entry preview by opening the detail route. There is no
DOM test runner in this repository: DOM wiring is covered by Node unit tests on
`site/core.js` plus static source assertions against `site/app.js`.

## Goals / Non-Goals

**Goals:**
- One pure, immutable core operation that changes only `parentId` and insertion
  position.
- Deterministic refusals that return the same document reference.
- A single persisted write per valid promotion, reusing `persist()`.
- Reuse of the existing reveal/focus path instead of new focus state.
- Keep `site/core.js` pure and easy to unit test.

**Non-Goals:**
- Cross-subject moves, group promotion, sibling re-parenting or multi-level
  nesting.
- A demotion command, a confirmation modal or an undo window for promotion
  (nothing is destroyed, so removal's snackbar/undo is not involved).
- Any change to counters, suggestion, tracking, ordering, notes, removal or the
  document schema.

## Decisions

### Decision: a dedicated pure core operation

Add `promoteItemToTopLevel(document, subjectId, itemId)` returning a new
document, or the same document reference on every refusal/no-op. Add
`canPromoteItemToTopLevel(document, subjectId, itemId)` as the boolean predicate
for tests and for gating the rendered control. This mirrors the existing style
(`planRemoval`, `setItemPriority`) and keeps all invariant logic out of
`app.js`, so the UI never duplicates business rules. Alternative considered: a
generic `updateItem` patch accepting `parentId`; rejected because `updateItem`
only handles title/priority/note and mixing a structural change into it would
loosen its validations.

### Decision: change only `parentId`, then re-insert after the former parent

The function validates: document shape, the subject exists, the item exists, the
item is not already top-level, and the parent exists, is itself top-level and is
not the item. It then builds `{ ...item, parentId: null }`, removes the item
from a copy of `subject.items`, and splices it in immediately after the former
parent's current position. Everything else is spread unchanged, so `id`,
`title`, `priority`, `done` and `note` are preserved and siblings keep their
`parentId`. The subject is replaced with a new object and the document with a
new object; the input arrays and item objects are never mutated. Alternative
considered: appending the promoted item at the end of `items`; rejected because
the backlog requires the position immediately after the former parent and a
deterministic manual order.

### Decision: stable sort preserves manual order, no position field

Because `sortedItems` uses a stable priority sort, the chosen array position
determines the manual order inside the promoted item's priority group. No
position field, document version or storage key is introduced. When the promoted
item and its former parent share a priority, the promoted item renders right
after the former parent; when their priorities differ, the primary priority
order still decides, which is the required existing behavior.

### Decision: reuse `revealAction` for focus after promotion

After a successful promotion, the handler sets `revealItemId` and `focusItemId`
to the promoted id and calls the existing `revealAction(subjectId, itemId)`.
That path already opens the detail view when the item is outside the overview
preview and otherwise focuses the item's row control via `applyFocus`. No new
focus flag is added. `persist()` is called exactly once, only when the returned
document differs from the current one (reference comparison).

### Decision: render the control exactly where substeps already render

The command belongs in `renderActions` next to the existing per-item controls,
rendered only when `item.parentId !== null`, so it appears identically in the
overview and the detail view (both use the same `renderItem`/`renderActions`
path). The former parent keeps using the existing `substepView` result, so it
automatically loses the disclosure control when it has no visible child after a
promotion. Alternative considered: a separate promotion button in the detail
header; rejected because the command is per-substep and must behave the same in
both views.

### Decision: test strategy without a DOM runner

Extend `tests/core.test.mjs` with deterministic cases for field preservation,
identity, insertion position, relative order, priority stability, refusal/no-op
reference equality and non-mutation of inputs. Add deterministic cross-feature
tests for `totalTaskCount`, `pendingCount`, `nextActionSuggestion`, `planRemoval`
and `parseDocument` round-trip. Add a Node static-assertion test that reads
`site/app.js` and checks the control label, its substep-only condition and the
single-`persist()` wiring. Real browser keyboard, touch, screen-reader and
visual behavior remain in Manual acceptance.

## Risks / Trade-offs

- [Wrong insertion index after interleaved arrays] → Remove the item from the
  copy first, then find the former parent's index in the resulting array and
  splice at `index + 1`; covered by unit tests with interleaved siblings and
  different priorities.
- [Accidental mutation of the existing document] → Copy-on-write for the item,
  the items array, the subject and the document; tests assert unchanged input
  references and deep-equal input snapshots.
- [Promotion hides the former parent's disclosure control unexpectedly] → This
  is the required behavior and is covered by a coherence test plus manual
  acceptance.
- [Focus cannot land on a promoted task hidden by the completed filter] → The
  operation still persists and reveals the task once the filter is cleared; this
  edge is recorded in the proposal's Uncertainties and in Manual acceptance
  instead of inventing a selector for an absent element.
- [Double save from reveal plus persist] → `revealAction` does not save (except
  through the normal render), and `persist()` is called once on a changed
  document; a static assertion checks the single write.

## Migration Plan

No migration: the exported JSON, `threadstep.document.v1` and every stored field
keep their shape and version. Deployment is the normal static PR to `main` plus
GitHub Pages; rollback is reverting the PR, which leaves any already-promoted
document valid because `parentId: null` is an ordinary V1 value.

## Open Questions

None that affect the specs, the approach or the task breakdown. The
completed-filter focus edge is a reported uncertainty, not a blocker.
