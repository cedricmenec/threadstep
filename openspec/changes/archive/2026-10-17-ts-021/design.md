# Design

## Context

See `proposal.md` — Why. Today `site/app.js` keeps `let collapsedParents = new
Set()`; `substepView(items, parentId, hideCompleted, collapsedIds)` treats a
parent as collapsed only when its id is in the set, so an empty set means every
parent is expanded. The set survives ordinary re-renders and is cleared on JSON
import; a reload starts empty (all expanded). Navigation uses a fragment route
(`#/sujet/<id>`) with a `hashchange` listener calling `render()`. There is no DOM
test runner in this repository: DOM behavior is covered by Node unit tests on
`site/core.js` plus static assertions against `site/app.js` source.

## Goals / Non-Goals

**Goals:**
- Make "all collapsed" the natural default without pre-computing parent ids.
- Reset transient expansion exactly on a change of view, not on re-renders.
- Keep `site/core.js` pure and testable; keep non-mutation guarantees.
- Preserve every existing disclosure, filter, focus and reveal behavior.

**Non-Goals:**
- Any new persistence, field, storage key or route.
- A global expansion control or remembering state between visits.
- Changing `site/core.js` business logic (counters, suggestion, ordering,
  notes, removal undo).

## Decisions

### Decision: model transient state as expanded parent ids, not collapsed ids

Track `expandedParents` (the parents the user voluntarily opened) instead of
`collapsedParents`. Default collapsed is then the empty set, which handles three
requirements at once: initial load, a newly added child under a childless parent
and reset, with no special-casing. `substepView(items, parentId, hideCompleted,
expandedIds)` computes `collapsed = hasVisibleSubsteps && !(expandedIds is a Set
containing parentId)`. `toggleCollapsedParent` becomes `toggleExpandedParent`
with identical copy-on-write semantics. Alternatives considered: keep
`collapsedParents` and seed it with every current parent on load; rejected
because a child added later would default expanded unless every add path also
writes the set, and because it duplicates "all" state.

### Decision: reset only on a change of parsed route

Keep the current `route` value. Add a pure core helper `isViewEntry(previous,
next)` that returns true when the parsed routes differ (using a stable view key
so `{view:"overview"}` equals only itself and `{view:"subject",subjectId}`
compares by id). In the `hashchange` handler, reset `expandedParents = new
Set()` only when `isViewEntry(route, parseRoute(location.hash))` is true; then
update `route` and render. The same-route `navigate()` branch (which calls
`render()` directly) and every ordinary re-render do not reset. `load()`, a
successful import and a `storage`-event reload also reset. This matches the
selected task: internal navigation and Back/Forward reset, simple re-renders
preserve voluntary openings. A pure helper keeps the transition rule unit
testable without a DOM. Alternative considered: reset inside `render()`;
rejected because every edit/priority/filter re-render would collapse the user's
work.

### Decision: one core helper for the ancestor of a reveal target

Add `substepAncestorId(items, itemId)`, returning the `parentId` when the item is
a direct substep, otherwise `null`. Before rendering a pending reveal
(`revealItemId`/`focusItemId`) or a restored removal, add that ancestor to
`expandedParents` so the target is rendered, highlighted and focusable. The
existing focus machinery (`pendingCollapseFocus`, `focusItemId`, `revealItemId`)
is reused unchanged. The expansion is in-memory only and disappears on the next
view entry, satisfying "développer temporairement … sans sauvegarder".
Alternatives considered: a dedicated reveal flag consumed at render; rejected as
more state to reconcile than reusing the expanded set.

### Decision: test strategy without a DOM runner

Extend `tests/core.test.mjs` with deterministic cases for the default-collapsed
view, per-parent independence, filter counts, toggle, `substepAncestorId` and
`isViewEntry`, including explicit non-mutation of `items` and the expanded set.
Add a Node test that reads `site/app.js` as text to assert the empty initial
`expandedParents`, the `isViewEntry`-driven reset wiring, the reveal-ancestor
call and the absence of `.innerHTML`; the same style already exists for
`renderItem`. Real browser keyboard, touch, screen-reader and visual behavior
remain in Manual acceptance.

## Risks / Trade-offs

- [Reset fires too often, collapsing work] → Reset is confined to the
  `hashchange` route-change branch and load/import, verified by a deterministic
  route-change unit test and a static assertion; ordinary render paths never
  touch the set.
- [Reset does not fire on Back/Forward] → Back/Forward always emits `hashchange`
  with a different parsed route, and the reset lives in that handler.
- [Accessibility regression from hidden-by-default content] → The disclosure
  control still appears with `aria-expanded="false"` and an accurate
  « Voir N sous-tâches » label; collapsed lists stay hidden and unfocusable.
  A keyboard/focus/manual pass is listed in Manual acceptance.
- [Reveal target stays hidden behind a collapsed ancestor] →
  `substepAncestorId` + the existing reveal focus path, covered by unit and
  static tests.
- [Product docs still state "starts expanded"] → FR-16 in `docs/product/mvp.md`
  and `guides` are updated in the same PR, with a grep assertion.

## Migration Plan

No data migration: the exported JSON, `threadstep.document.v1` and every stored
field are untouched. Deployment is the normal static PR to `main` plus Pages;
rollback is reverting the PR, which restores the previous expanded default with
no data consequence.

## Open Questions

None that affect the specs, approach or task breakdown.
