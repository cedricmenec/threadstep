# Design

## Context

See `proposal.md` — Why. `site/app.js` holds one in-memory `documentState`
(`{ version: 1, subjects: [...] }`), renders it through
`render()`/`renderSubject()`/`renderItem()`, and writes it with `persist()`
(localStorage write plus full re-render). Domain logic lives in pure helpers in
`site/core.js` (`newItem`, `sortedItems`, `visibleItems`, `pendingCount`,
`parseDocument`, `moveSubject`, `updateItem`), and the codebase already
establishes two reusable conventions:

- pure helpers that return the **same input reference** for invalid/no-op cases
  (`moveSubject`, `updateItem`);
- a deferred-focus pattern: `focusItemId` is stored, `render()` runs, then
  `applyFocus()` finds the node by `data-item` and focuses its « Modifier »
  control (`app.js:50-61`).

The counter lives at `index.html:33` (`#counter`), next to the dashboard
heading. Ranking already exists as `PRIORITIES = ["urgent","normal","later"]`
and `priorityIndex`. There is no schema/version change to make.

## Goals / Non-Goals

**Goals:**

- Add one pure, deterministically testable selector in `site/core.js`.
- Show a compact, non-modal, view-only card near the counter, recomputed on
  each activation, with an accessible reveal into the list.
- Change no stored data and no document shape.

**Non-Goals:**

- Persisting or restoring the suggestion; storing "last suggestion".
- Substep-level candidates, completion/editing from the card, or manual
  within-priority ordering.
- Any new dependency, backend, schema bump or storage-key change.

## Decisions

1. **Pure selector `nextActionSuggestion(document)` in `site/core.js`.** It
   returns `{ subjectId, subjectTitle, itemId, itemTitle, priority }` for the
   winning candidate or `null` when none exists. It never mutates its input.
   Rationale: mirrors `moveSubject`/`updateItem`, is testable without a DOM, and
   keeps `app.js` free of ranking logic. Alternative rejected: computing the
   winner inside the click handler (untestable, duplicates ranking).

2. **Ranking key and candidate filter.** Iterate `document.subjects` in array
   order and each subject's raw `items` array in order; keep entries with
   `parentId === null && done === false`; choose the minimum
   `(priorityIndex(priority), subjectIndex, itemIndex)`. This makes priority
   dominant globally, then subject order, then underlying storage order, exactly
   as worded in the backlog. Substeps (`parentId !== null`) and completed
   parents never enter the candidate set. Complexity is one linear pass.

3. **In-memory suggestion state, no persistence.** `app.js` keeps a
   `suggestion` variable (the selector result or a sentinel for "none"). The
   control's click handler recomputes from `documentState` before rendering the
   card. Activating it never calls `persist()`, so localStorage/export stay
   untouched, and a reload re-runs `load()`/`render()` with no card. The card is
   placed in a dedicated region near the counter with `aria-live="polite"` so
   it is announced, and includes a « Fermer » control to hide it. Rationale:
   view-only requirement; minimal state.

4. **Reveal via the existing focus pattern.** « Voir dans la liste » sets
   `focusItemId = suggestion.itemId` and a `revealItemId` used to tag the match
   with a highlight class, then re-renders. `applyFocus()` focuses the item's
   « Modifier » control (the established destination) and calls
   `scrollIntoView({ block: "nearest" })`. Because the selected action is
   unfinished, it is always rendered even when « Masquer les terminées » is on,
   so reveal never targets a hidden node. Rationale: reuses tested behavior and
   keeps keyboard focus on a real control. Alternative rejected: a toast or a
   modal (explicitly non-modal; more code and focus management).

5. **Safe text.** The card builds nodes with the existing `el()` helper and
   `textContent` only, matching every other render path; user text such as
   `<img …>` is shown literally. No `innerHTML` is introduced.

## Risks / Trade-offs

- **Priority-dominant ranking may surprise users who expect per-subject
  rotation.** → Accepted: it is the literal backlog ordering and is fully
  documented; changing it later is a spec change, not a data migration.
- **A full re-render replaces the card after any state change**, so the card can
  disappear when the user completes or reorders something. → Accepted and
  consistent with "recompute from current state"; the fixed card state is
  re-derived on the next activation.
- **Highlight class persistence across renders.** → Mitigation: the highlight is
  derived from `revealItemId`, which is cleared on the next control activation
  and on reload, so it cannot be stored or accumulate.
- **`scrollIntoView` differences across browsers.** → Mitigation: use
  `block: "nearest"` and always move focus to a real control, so the outcome
  remains keyboard-accessible even if smooth scrolling is unavailable.

## Migration Plan

None. No schema, version or storage-key change; existing local data and exported
JSON load unchanged. Rollback is removing the control, card and helper; stored
documents stay valid.

## Open Questions

None that change the specs or approach. The ranking interpretation, reveal
destination and dismiss affordance flagged in `proposal.md` are resolved here
and are safe to confirm during review.
