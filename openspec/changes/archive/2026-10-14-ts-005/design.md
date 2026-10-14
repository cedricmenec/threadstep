# Design

## Context

See `proposal.md` — Why. The current app keeps a single in-memory `documentState`
(`{ version: 1, subjects: [...] }`) in `site/app.js`, renders it with
`render()`/`renderSubject()`/`renderItem()`, and calls `persist()` (a
localStorage write followed by a full re-render). All domain logic lives in
pure helpers in `site/core.js` (`newItem`, `sortedItems`, `parseDocument`,
`moveSubject`). `moveSubject` already establishes the convention of returning
the **same array reference** for invalid/no-op operations so callers can skip
persistence and re-render. Titles are rendered with `textContent`, values are
bounded (`input.maxLength = 300`, `parseDocument` validates `1..300` on stored
titles), and there is no schema/version change to make.

## Goals / Non-Goals

**Goals:**

- Add in-place editing of `title` and `priority` through a small, pure,
  independently testable update helper.
- Preserve identity (`id`, `done`, `parentId`, subject) and the exact document
  shape, so localStorage and JSON export/import stay compatible.
- Keep the UI change small, accessible from keyboard and touch, and consistent
  with existing rendering/persistence patterns.

**Non-Goals:**

- Editing any field other than `title` and `priority`.
- New nesting levels, re-parenting, bulk editing or manual within-priority
  ordering.
- Any new dependency, backend, schema bump or storage-key change.

## Decisions

1. **Pure updater in `site/core.js`.** `updateItem(document, subjectId,
   itemId, { title, priority })` returns a new document when the edit is valid
   and effective, and the original `document` reference when the subject/item
   is missing, the patch is invalid, or the values are unchanged. Rationale:
   matches the `moveSubject` convention, keeps validation testable without a
   DOM, and lets `app.js` skip `persist()` on no-op. Alternative rejected:
   mutating the item inside `app.js` (untestable and easy to corrupt the
   document).

2. **Immutable structural sharing.** On success, rebuild only
   `subjects → the target subject → its items → the target item`, leaving all
   other subject/item objects by reference. This guarantees unrelated data and
   the original inputs are untouched, and that `parseDocument` round-trips.

3. **Validation mirrors `parseDocument`.** The helper trims the title and then
   requires a trimmed length of `1..300`; it accepts only `PRIORITIES`. This is
   the round-trip-safe reading of the backlog ("trim before saving", "longer
   than 300 characters") and avoids producing documents that import would
   reject.

4. **Single inline editor managed by UI state.** `app.js` keeps an
   `editingItemId` (and the draft lives in the rendered inputs). `renderItem`
   renders the editor in place when the id matches. Activating « Modifier » on
   another action replaces the open editor and discards its unsaved draft.
   Saving calls `updateItem` then `persist()`; cancelling clears the id and
   re-renders without touching storage. Rationale: minimal state, reuses the
   existing full re-render. Alternative rejected: per-item patching of the DOM
   (more code, more drift from current patterns).

5. **Deterministic focus.** After save or cancel, store the edited item's id and
   focus that item's « Modifier » control after the render; when a priority
   change reorders the item, lookup is by item id, so focus follows the same
   action (mirrors the `focusAfterMove` pattern). The editor inputs use
   `textContent`/`.value` only, so a title such as `<img …>` is shown literally.

## Risks / Trade-offs

- **Full re-render while editing** could reset a draft if another render is
  triggered (for example a cross-tab `storage` event). → Accepted: a `storage`
  event means another tab changed the document, so resetting to stored values
  is the safer behavior; the draft is never silently persisted.
- **Reordering after save** moves the edited action, so naive focus would jump
  to the wrong node. → Mitigation: focus by item id (`data-item`) after render.
- **Trim-before-validate** allows a raw string over 300 characters whose
  trimmed form is ≤ 300. → Mitigation/acceptable: the input `maxLength` caps raw
  typing at 300 and `parseDocument` validates the trimmed stored title, so both
  the UI and the importer agree.
- **Scope creep into other fields.** → Mitigation: the helper's patch type is
  limited to `title` and `priority`, and no other field is read or written.

## Migration Plan

None required. The document shape, version and storage key are unchanged, so
existing local data and exported JSON load as-is. Rollback is limited to
removing the control/editor and helper; stored documents remain valid.

## Open Questions

None that change the specs or approach. The two product decisions flagged in
`proposal.md` (trim-then-measure for the length limit, and single-editor
replacement) are resolved here as stated and are safe to confirm during review.
