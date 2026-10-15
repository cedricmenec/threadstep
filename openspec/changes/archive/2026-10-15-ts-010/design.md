# Design

## Context

See `proposal.md` — Why. Removals today are a one-line, irreversible mutation in
`renderActions`: `subject.items = subject.items.filter((entry) => entry.id !==
item.id && entry.parentId !== item.id); persist();` (`site/app.js:340-347`).
`persist()` writes `threadstep.document.v1` and re-renders; `render()` rebuilds
`#subjects`, `#focus-card` and `#resume-card` only (`site/app.js:81-93`). Domain
logic lives in pure, non-mutating helpers in `site/core.js`, tested with
`node --test` in `tests/core.test.mjs`. The existing deferred-focus pattern sets
`focusItemId` (or `editingItemId`), re-renders, then `applyFocus()` locates the
node by `data-item` and focuses its « Modifier » control (`site/app.js:94-108`).
TS-008 keeps a browser-local `resumeRef`/`RESUME_KEY` reconciled on every render
by `reconcileResume()` (`site/app.js:72-80`), which clears an orphaned reference.

Constraints: browser-only, no dependency, no test DOM harness, no new storage
key, no schema/version change, keep whole-subject deletion and import
confirmations unchanged.

## Goals / Non-Goals

**Goals:**

- Make the existing removal immediately reversible for a bounded, tab-local
  10-second window.
- Keep the deterministic removal/restore/ordering logic pure and unit-testable
  without a DOM, separate from rendering and timers.
- Restore the removed subtree byte-for-byte and preserve unrelated concurrent
  changes.
- Keep TS-008 tracking coherent across a removal and its undo.
- Keep the change non-modal, accessible, mobile-safe, dependency-free and
  compatible with the existing document and export/import.

**Non-Goals:**

- Undoing a whole-subject deletion, persistent trash/history, undo after reload
  or after expiry.
- Changing the document schema/version, storage keys or JSON shape.
- Adding a DOM test harness, dependency, backend or network use.
- Redesigning removal, import/export or the existing confirmations.

## Decisions

1. **Pure helpers in `site/core.js`, separated from DOM and timer.**

   - `planRemoval(document, subjectId, itemId)` → `{ document, removal }`. On a
     no-op (missing subject or item) it returns the **same** document reference
     and `removal: null`, mirroring `moveSubject`/`updateItem`. Otherwise it
     returns a new document without the target and, for a top-level target, all
     items whose `parentId === itemId`, plus a receipt.
   - Receipt shape: `{ subjectId, rootId, entries }` where `entries` is
     `[{ index, item }]` in ascending original-index order and `item` is a shallow
     copy (`{ ...entry }`) of a removed item. `entries` captures the exact
     original position in `subject.items`, so restoration can rebuild order.
   - `restoreRemoval(document, removal)` → new document with the receipt's entries
     re-inserted at their original indices (`Math.min(index, length)` to stay safe
     after other changes), skipping any id already present; returns the same
     reference for a null/invalid receipt, a missing subject, or nothing to
     insert. It never recreates a removed subject.
   - `removalContainsItem(removal, itemId)` → boolean, used to decide whether the
     live tracked reference belonged to the removed subtree.
   - `restorableTrackingRef(document, trackedRef)` → `trackedRef` when
     `resumeView(document, trackedRef)` resolves, else `null`.

   Rationale: mirrors the pure, DOM-free helpers already covered by
   `tests/core.test.mjs`; every acceptance behavior except the timer and focus can
   be asserted deterministically. Alternative rejected: keeping the filter in
   `app.js` (untestable, no positional receipt).

2. **Ephemeral `pendingRemoval` state and a cancellable timer in `app.js`.**
   `pendingRemoval` holds `{ subjectId, rootItemId, removal, trackedRef }` or
   `null`. The countdown uses one `setTimeout` with a deadline timestamp and a
   `remaining` value; `suspend`/`resume` clear and re-arm the same timeout. There
   is no polling. `invalidatePendingRemoval()` clears the timeout and the state.
   Rationale: a single cancellable timer matches the acceptance criteria and
   avoids leaks.

3. **Snackbar as a fixed region outside the re-rendered trees.**
   `site/index.html` gains `#snackbar` (`role="status"`, `aria-live="polite"`,
   `hidden`) placed outside `#subjects`/`.dashboard`. `render()` never clears it,
   so unrelated re-renders preserve the window. On removal, `showSnackbar()`
   builds the message « Étape retirée » and an « Annuler » button with the
   existing `el()`/`textContent` helper and an `aria-label` naming the removed
   step. Alternative rejected: rendering the snackbar inside `#subjects` (would be
   destroyed by any re-render).

4. **Focus management.**
   Add a deferred `focusSubjectId`: after a removal, focus the originating
   subject card (`tabIndex = -1`, already set) so focus is never lost. After an
   undo, reuse `focusItemId`/`revealItemId` on the restored root to focus its
   « Modifier » control and highlight it. `Annuler` is **not** auto-focused, so the
   countdown still expires on its own; when a keyboard user tabs into the
   snackbar, `focusin`/`focusout` suspend and resume the timer.

5. **Invalidation.**
   Call `invalidatePendingRemoval()` when the subject is deleted (after its
   confirm), after a successful import, and in the `storage` event handler before
   `load()`. A new removal also calls it first, replacing the previous window. The
   state is in-memory only, so reload never restores anything and no key is added.

6. **TS-008 interaction.**
   Before persisting a removal, if the live `resumeRef` belongs to the removed
   subtree (`removalContainsItem`), capture it in `pendingRemoval.trackedRef`.
   Any explicit tracking change while a removal is pending (pin or clear) sets
   `pendingRemoval.trackedRef = null`. On undo, after restoring the document,
   `restorableTrackingRef(document, pendingRemoval.trackedRef)` decides whether to
   re-set `resumeRef` and rewrite `RESUME_KEY`. The automatic cleanup on removal is
   unchanged, so a non-undone removal leaves no orphan reference.

## Risks / Trade-offs

- **Index-based reinsertion after unrelated changes** → Re-insertion clamps the
  recorded index to the current length and keeps removed entries' relative order,
  so restored items stay adjacent and other items are preserved; asserted by
  concurrent-change tests.
- **`role="status"` around an interactive button** → The message text remains in a
  polite live region and the button is a normal, focusable control with an
  accessible name; verified manually across keyboard use.
- **Timer vs. focus interaction** → Suspending on `focusin` and resuming on
  `focusout` keeps the promise "no interaction ⇒ closes after ~10 s" while giving a
  keyboard user time; the remaining time is stored so resume is accurate.
- **Focus after removal differs across browsers** → The subject card is a real,
  labelled focus target and the restored action reuses the proven TS-005 reveal
  path.
- **Full re-render on every mutation** → The snackbar lives outside the rendered
  lists and `pendingRemoval` is plain state, so it survives re-renders.
- **Tracking capture edge cases** → Capturing the reference before the automatic
  cleanup and nulling it on any explicit tracking change implements "never restore
  a tracking invalidated by a later user action"; covered by pure tests plus manual
  DOM verification.

## Migration Plan

None. No schema, version, storage-key or export change; removal keeps writing the
same `threadstep.document.v1` payload. Rollback is removing the snackbar, the
state/timer and the helpers; stored documents and exports stay valid.

## Open Questions

None that change the specs, approach or task breakdown. Wording, focus targets,
snackbar placement and DOM-coverage limits are recorded as assumptions in
`proposal.md` and are safe to confirm during review.
