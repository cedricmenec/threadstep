# Design

## Context

See `proposal.md` — Why. ThreadStep is one static page: `site/app.js` holds the
only DOM state (a module-level `documentState`, presentation flags such as
`editingItemId`, `hideCompleted`, `collapsedParents` and deferred focus flags) and
renders the whole overview into `#subjects` (`site/app.js:94-107`).
`site/core.js` holds pure domain functions with no DOM. There is no router, no
history handling and no DOM test harness; automated tests exercise only
`site/core.js` through `tests/core.test.mjs`. Every accepted business mutation
calls `persist()`, which writes `threadstep.document.v1` and fully re-renders
(`site/app.js:41-50`). Drag targets are resolved with
`task.closest(".subject")` and matched on `dataset.subject`
(`site/app.js:516-537`), and deferred focus flags are consumed by `applyFocus()`
against `#subjects` after each render (`site/app.js:108-167`). The subject title
is validated by `parseDocument` as a trimmed non-empty string of at most 100
characters (`site/core.js:281`). Constraints: browser-only, no new dependency or
storage key, no schema/version change, French accessible UI, relative
GitHub Pages paths, and no mutation during pure navigation.

## Goals / Non-Goals

**Goals:**

- One deterministic, DOM-free route primitive and one pure, targeted
  subject-title rename primitive in `site/core.js`.
- A single-subject detail view rendered into the existing `#subjects` region so
  the existing task controls, drag resolution, focus flags and persistence path
  are reused unchanged.
- Navigation (open, return, Back/Forward, reload, fallback) that provably writes
  nothing.
- Reuse the same document, ids and business functions in both views; no copies.

**Non-Goals:**

- A DOM test harness, a new dependency, a framework or a rewritten renderer.
- Any schema, version, storage-key or export/import shape change.
- Duplicating subjects or remapping ids; a new subject deletion from the detail
  view; changing any existing task capability.

## Decisions

1. **Extract pure route helpers into `site/core.js`.**
   - `subjectRoute(subjectId)` returns the canonical fragment
     `"#/sujet/" + encodeURIComponent(subjectId)` for a valid id (non-empty
     string, length ≤ 100, matching `validId`), and `null` otherwise.
   - `parseRoute(hash)` returns a small descriptor:
     `{ view: "overview" }` for an empty/`#`/`#/` fragment or an unrelated
     fragment; `{ view: "subject", subjectId }` when the fragment is
     `#/sujet/<id>` and the decoded id is valid; `{ view: "invalid" }` when the
     fragment names the subject route but the id part is empty, undecodable or
     invalid. It never throws and never touches a document.
   - `findSubject(document, subjectId)` returns the matching subject reference or
     `null`, without mutating or copying. Reusing the exact reference is what
     proves "same document, same ids".
   - **Rationale:** keeps all routing logic unit-testable in Node and DOM-free.
     Alternatives rejected: reading `location` inside `core.js` (not pure, not
     testable) and putting parsing in `app.js` (no automated coverage).

2. **One route variable in `app.js` and a single `render()` branch.**
   - Add `let route = parseRoute(location.hash)` and a `navigate(hash)` helper
     that sets `location.hash` and lets the `hashchange` listener call
     `render()`. `render()` renders either the overview (as today) or the detail
     view into `#subjects` based on `route`.
   - Resolve the target subject on every render with
     `findSubject(documentState, route.subjectId)`. If it is missing (id absent,
     imported away or removed elsewhere), render a fallback panel instead.
   - **Rationale:** `render()` already fully rebuilds the view, so branching
     there is the smallest change and reuses every existing control closure.
     `hashchange` also covers browser Back/Forward and reload, satisfying the
     history requirement without `pushState` bookkeeping.

3. **Navigation never persists.**
   - `navigate()` and the `hashchange` handler call `render()` only. `persist()`
     remains reachable only from business actions. This keeps the
     presentation-only requirement provable: opening/closing/switching views
     cannot write localStorage or change the document.
   - **Rationale:** the existing architecture already separates `persist()` from
     `render()`, so the guarantee is structural rather than defensive.

4. **Factor a reusable `renderTaskArea(subject)` and reuse it in both views.**
   - Move the task form, the `visibleItems`/`renderItem` list and the empty
     message out of `renderSubject` into `renderTaskArea(subject)`.
     `renderSubject` renders the overview card head (title, pending count, move
     and delete controls) then the shared task area. The detail view renders its
     own head (subject title, subject-local pending count, « Retour à la vue
     d'ensemble », « Renommer le projet ») then the same task area.
   - Wrap the detail task area in a `<section class="subject detail" data-subject
     ="<id>">` so `resolveDropTarget`, `applyFocus` and the deferred move/collapse
     /priority focus flags keep working unchanged.
   - **Rationale:** guarantees identical rendering and behavior for tasks and
     substeps in both views. Alternatives rejected: a second renderer (would
     drift) and inline reuse of `renderSubject` (would also show the subject
     move/delete controls that the detail view does not need).

5. **Detail chrome: hide only overview-scoped, project-revealing widgets.**
   - While in the detail view, hide `#subject-form` (adding subjects) and the
     `#focus-suggest`/`#focus-card` and `#resume-card` cards, because they can
     expose another subject's title and the spec forbids any other project in the
     detail view. Keep the global counter, the completed filter, the reorder
     note, the export/import toolbar and the undo snackbar, which are not tied to
     a single project card.
   - Actions « Voir dans la liste » from the suggestion/tracking cards return to
     the overview before revealing, so existing behavior stays coherent from both
     views. This is presentation-only.
   - **Rationale:** direction is derived from the acceptance criterion "aucun
     autre projet ne figure dans cette vue"; the set is a reviewable detail (see
     proposal uncertainty).

6. **Pure, targeted rename.**
   - `renameSubject(document, subjectId, title)` accepts a string title, trims
     it, and rejects anything that is not a non-empty string of at most 100
     characters (the same rule `parseDocument` applies to subject titles). On
     invalid input, an unknown id, or a trimmed title equal to the current one,
     it returns the same `document` reference (no-op, nothing written). On
     success it rebuilds only `subjects` and the matching subject, replacing
     `title` and preserving `id`, `items`, every `parentId`, order and priority.
   - The detail view shows « Renommer le projet » which swaps the head for an
     inline form (input, « Enregistrer », « Annuler », a `role="alert"` error
     node) modelled on `renderEditor`. « Enregistrer » validates locally for an
     immediate message and then calls `renameSubject`; only a new document
     reference triggers `persist()`. « Annuler » re-renders without calling
     `persist()`.
   - **Rationale:** isolates the only new business write in one pure, tested
     function, so `app.js` cannot rebuild ids or relations.

7. **Focus, accessibility and continuity.**
   - Add deferred focus descriptors: after opening, focus the detail heading
     (`tabIndex = -1`); after returning, focus the « Ouvrir le projet » control of
     the subject that was open; after a rename save/cancel, focus the rename
     control. Reuse the existing `applyFocus()` consumption pattern.
   - Every new control is a native French `<button>`/`<form>` with an accessible
     name, the detail heading is a real heading, titles stay text nodes, and
     touch targets/focus styles match the existing ≥ 44 × 44 px convention with
     no `prefers-reduced-motion` animation.
   - **Rationale:** consistent with the shipped accessibility contract.

8. **Docs and tests.** `tests/core.test.mjs` gains route round-trip / overview /
   invalid / non-mutation cases for `subjectRoute`, `parseRoute` and
   `findSubject`, plus rename validation, no-op, preservation, round-trip and
   no-migration cases and a non-regression check of the existing task functions
   on a navigated/renamed document. `docs/product/guide-utilisation.md` and
   `docs/product/mvp.md` gain the user-facing section and functional
   requirement. No DOM test harness is introduced.

## Risks / Trade-offs

- **Anchor/hash collision with existing behavior** → the app uses no fragment
  today; unrecognized fragments fall back to the overview, and only
  `#/sujet/<valid id>` opens a detail view, so no existing link breaks.
- **Global chrome exposes another subject** → hide the two overview per-item
  cards in the detail view, as decided above, and route their reveal actions
  back through the overview.
- **Drag and focus regression in the detail view** → reuse the exact
  `renderTaskArea`, `.subject`/`data-subject` wrapper and deferred focus flags;
  verify all task gestures manually in both views and keep the existing
  `tests/core.test.mjs` non-regression assertions.
- **Duplicate render from `hashchange` after `navigate()`** → `render()` is
  idempotent and writes nothing; the extra render is cheap and side-effect free.
- **Canonical spec drift** → the change only ADDs two new capabilities; existing
  canonical specs are untouched and a post-sync review confirms it.

## Migration Plan

None. No schema, version, storage-key or export/import change is made; the route
is transient and the rename writes the existing `title` field. Rollback removes
the route, the detail rendering and the rename control and leaves every stored
document and export valid.

## Open Questions

None that change the specs, the approach or the task breakdown. The exact set of
hidden overview widgets, the fragment-connector wording and the final spacing are
recorded as uncertainties in `proposal.md` and are safe to confirm during review.
