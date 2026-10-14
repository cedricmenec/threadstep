# Design

## Context

See `proposal.md` — Why. `site/app.js` keeps one in-memory `documentState`
(`{ version: 1, subjects: [...] }`) plus ephemeral UI state (`editingItemId`,
`focusItemId`, `revealItemId`, `suggestionVisible`, `hideCompleted`). It renders
through `render()` → `renderSubject()` → `renderItem()`, and every mutation ends
in `persist()` (localStorage write + full re-render) except the view-only TS-007
suggestion. Domain logic lives in pure helpers in `site/core.js`
(`newItem`, `sortedItems`, `visibleItems`, `pendingCount`, `parseDocument`,
`moveSubject`, `updateItem`, `nextActionSuggestion`).

Two existing conventions to reuse:

- Pure helpers return the **same input reference** for invalid/no-op cases
  (`moveSubject`, `updateItem`) and never mutate their input.
- A deferred-focus pattern: set `focusItemId`, call `render()`, then
  `applyFocus()` locates the node by `data-item` and focuses its « Modifier »
  control and `scrollIntoView({ block: "nearest" })` (`app.js:55-69`). A
  `revealItemId` adds the `.task.reveal` highlight (`app.js:193`,
  `styles.css:56`).

Storage currently has one key, `STORAGE_KEY = "threadstep.document.v1"`
(`core.js:2`). The document schema must not change. `docs/product/mvp.md` FR-13
already states the intended behavior, so this change realizes it without
touching the schema.

## Goals / Non-Goals

**Goals:**

- Add pure, deterministically testable resume helpers in `site/core.js`.
- Store the single tracked reference under a **separate** localStorage key,
  never inside the document, so JSON export/import stays byte-compatible.
- Reconcile the reference against the current document on load and after every
  mutation, clearing it when it no longer resolves.
- Reuse the existing reveal/focus/highlight path rather than building a second
  navigation system.

**Non-Goals:**

- Persisting the reference inside `threadstep.document.v1` or any export.
- Tracking substeps, multiple actions, or history.
- An `aria-pressed` toggle as the primary control (see Decisions).
- Any new dependency, DOM test harness, backend, schema bump or storage-key
  change to the document.

## Decisions

1. **Pure helpers and a separate key in `site/core.js`.**

   - `export const RESUME_KEY = "threadstep.resume.v1";`
   - `export function parseResumePreference(raw)` → `{ subjectId, itemId }` or
     `null`. Accepts the raw localStorage string; tolerates `null`, malformed
     JSON, non-objects, empty/oversized IDs (reusing the existing `validId`
     bound of ≤100 chars) without throwing.
   - `export function serializeResumePreference(ref)` → JSON string for a valid
     ref, `null` otherwise.
   - `export function resumeView(document, ref)` → `{ subjectId, subjectTitle,
     itemId, itemTitle, priority }` when `ref` resolves to an **existing
     unfinished top-level** action (`parentId === null && done === false`) in an
     existing subject, else `null`. Never mutates its input.

   Rationale: mirrors `moveSubject`/`updateItem`, isolates all resolution and
   validity logic from the DOM, and is unit-testable with the built-in Node test
   runner. Alternative rejected: reading localStorage and resolving inside
   `app.js` (untestable, duplicates validation).

2. **In-memory `resumeRef` + explicit reconcile.**
   `app.js` holds `resumeRef` (the parsed `{ subjectId, itemId }` or `null`) and
   a `documentLoaded` flag. `reconcileResume()` runs `resumeView(documentState,
   resumeRef)`:
   - valid → keep `resumeRef`, return the view model for the card;
   - invalid **and** a `resumeRef` was present **and** the document was
     successfully loaded/imported → set `resumeRef = null` and
     `localStorage.removeItem(RESUME_KEY)` so no orphan reference remains.

   It is called at the end of `load()` (after a successful parse), at the end of
   the import path, and inside `render()` so every mutation that triggers a
   re-render cleans up. If the local document fails to parse, reconcile is
   skipped so a temporarily unreadable document never discards the preference.
   Rationale: one code path covers completion, removal, subject removal and a
   mismatched import; matches the backlog's "supprimer proprement la référence".

3. **Pin control on unfinished top-level actions.**
   `renderActions` already branches on `item.parentId === null`. Inside that
   branch, a non-tracked unfinished action gets an enabled button
   « Garder le fil » with `aria-label` `"Garder le fil : " + item.title`; its
   handler sets `resumeRef = { subjectId, itemId }`, writes
   `localStorage.setItem(RESUME_KEY, serializeResumePreference(...))` and
   re-renders. The currently tracked action instead renders its control as a
   disabled button labelled « Action suivie » (accessible name
   `"Action suivie : " + item.title`), so the state is announced and the
   replacement affordance stays on the other actions. Completed actions and
   substeps get **no** control, matching the scope.
   Alternative considered: `aria-pressed` toggle. Rejected because a second
   press would imply an unspecified unpin and would duplicate
   « Ne plus suivre ».

4. **Resume card near the top of the interface.**
   `index.html` gains a `#resume-card` region as the first block of the
   `.dashboard` section with `aria-live="polite"` and `hidden` by default.
   `renderResumeCard()` fills it only when `reconcileResume()` returns a view
   model: title « Je reprends ici », subject name, action title, priority label,
   a « Voir dans la liste » button and a « Ne plus suivre » button. Text is
   built with the existing `el()` helper and `textContent` only.
   « Voir dans la liste » reuses `revealItem(resume.itemId)` (sets
   `revealItemId` + `focusItemId`, then `render()` → `applyFocus()`).
   « Ne plus suivre » sets `resumeRef = null`, removes `RESUME_KEY`, clears
   `revealItemId` and re-renders — without touching the action or calling
   `persist()`. Rationale: single card, no second navigation system, safe text.

5. **Tracking keyed by IDs, so edits/reorders are transparent.**
   `resumeView` resolves by `subject.id` and `item.id`. Renaming or
   reprioritizing (`updateItem`) preserves IDs, and `moveSubject` preserves
   both IDs and subject membership, so the card simply re-derives new
   title/priority/position on the next render. Pinning never mutates the
   document, so no IDs, flags, priorities or orders change.

6. **TS-007 independence.**
   The suggestion uses `suggestionVisible` + `nextActionSuggestion(documentState)`
   and never reads or writes `resumeRef`/`RESUME_KEY`, and the resume card never
   reads `suggestionVisible`. The two features share only the reveal/focus
   helper. Activating the suggestion therefore cannot change the tracked action.

## Risks / Trade-offs

- **Disabled « Action suivie » is not keyboard-focusable**, so a keyboard user
  cannot tab to the tracked action's control. → Accepted: it is a state, not a
  command; the card (with its focusable « Voir dans la liste » / « Ne plus
  suivre ») announces and exposes the actionable controls, and the tracked row
  is reachable via reveal.
- **Full re-render replaces the card after any state change.** → Accepted:
  `reconcileResume()` re-derives the card from the current document each render,
  so it stays correct rather than stale.
- **Cleanup writes to localStorage on completion/removal.** → Accepted and
  intentional: it only touches `threadstep.resume.v1`, never the document, and
  only when an orphaned reference existed (guarded by `resumeRef`).
- **Importing another document silently drops tracking.** → Accepted: the
  imported document is a full replacement; keeping a reference to an absent
  action would be an orphan. Documented as a scenario.
- **`scrollIntoView`/focus differences across browsers.** → Mitigated exactly as
  in TS-007: `block: "nearest"` plus focus on a real control, and a visible
  `.reveal` highlight as fallback.

## Migration Plan

None. This adds a new, independent localStorage key (`threadstep.resume.v1`);
existing documents, exports and imports are untouched, and no document field or
version changes. Rollback is removing the control, the card and the helpers,
plus optionally `localStorage.removeItem("threadstep.resume.v1")`; stored
documents remain valid.

## Open Questions

None that change the specs, approach or task breakdown. The wording, tracked
state affordance, card placement, orphan-handling and DOM-test coverage flagged
in `proposal.md` are resolved here and are safe to confirm during review.
