# Proposal

## Why

Removing a next step is currently irreversible and asks for no confirmation, so a
mistaken tap on « Retirer » — easy on a phone — silently destroys the action, its
substeps and their completion state. Letting the user undo that one removal for a
short, bounded window makes the existing removal safe without adding a blocking
dialog, a backend or a change to the stored document (FR-02).

## What Changes

- Keep the existing immediate, confirmed-free removal: « Retirer » on a top-level
  action or a substep deletes it (and, for a parent, its substeps) and persists
  the document to `threadstep.document.v1` at once.
- Add a discreet, non-modal **snackbar** at the bottom of the screen with the
  French message « Étape retirée » and a real, accessible « Annuler » button.
- Keep the undo window open for **10 seconds** from the removal, driven by a
  cancellable timer (no polling, no network). Without interaction the snackbar
  closes and the undo expires; a later activation restores nothing.
- « Annuler » restores the removed action and any substeps **exactly** — same
  `id`, title, priority, `done`, `parentId` and original position in the subject's
  item array — and re-persists so exports and reloads reflect the restoration,
  while preserving unrelated changes made in the meantime.
- Allow **one** reversible removal at a time; a new removal closes the previous
  window and replaces the snackbar. Only the last removal is restorable.
- Invalidate a pending undo (without recreating data) when its subject is
  removed, when a JSON import replaces the document, or when another tab replaces
  the data through the `storage` event.
- Keep the undo window **tab-local and temporary**: reloading or closing the page
  never restores the action, and no trash/history, new storage key or schema
  version is introduced.
- Restore the « Je reprends ici » selection after an undo, but only when the user
  has not changed tracking since the removal (see the `resume-tracking` delta).
- Announce the message through a non-intrusive live region, keep keyboard focus
  from being lost, pause the countdown while focus is inside the snackbar, keep
  the snackbar above the mobile safe area, and respect `prefers-reduced-motion`.
- Leave whole-**subject** removal and import confirmation exactly as they are; no
  subject deletion uses this snackbar.

## Capabilities

### New Capabilities

- `action-removal`: immediate removal of a top-level action or substep with a
  short, local, non-modal and exactly-restorable undo window, plus the
  invalidation, single-window and accessibility rules that govern it.

### Modified Capabilities

- `resume-tracking`: requirement « Automatic cleanup » is extended so that, when
  a removal that cleared the tracked action is undone and the user has not
  changed tracking since, the previous « Je reprends ici » reference is restored.
  All other resume-tracking requirements and scenarios stay unchanged.

## Impact

- `site/core.js`: pure removal/restore helpers and a small tracking-restore
  predicate; no mutation of inputs.
- `site/app.js`: a `pendingRemoval` state, cancellable timer with
  focus suspension, removal/undo wiring, invalidation on subject removal,
  import, `storage` and new removal, focus management and resume
  capture/restore.
- `site/index.html`: a `#snackbar` live region outside the re-rendered lists.
- `site/styles.css`: fixed, safe-area-aware snackbar styling with a comfortable
  touch target and a reduced-motion guard.
- `tests/core.test.mjs`: deterministic Node tests for removal, subtree restore,
  ordering, concurrent changes, invalidation, single-window replacement and
  tracking restore.
- `docs/product/mvp.md`: FR-02 / acceptance tests aligned with the delivered
  behavior.
- Unchanged: document schema and version, `threadstep.document.v1` and
  `threadstep.resume.v1` keys, JSON export/import shape, whole-subject deletion
  and import confirmations, GitHub Pages URLs, dependencies, workflows and
  factory policy.

## Non-Goals / Out of Scope

- Undoing the removal of a whole subject; a persistent trash or multi-level
  history; undo after reload or after the 10-second window.
- Deferred deletion: the document is written immediately; only the undo window
  is ephemeral.
- Cross-device or cross-tab synchronization, mobile swipe gestures, system
  notifications, AI in the interface, and any new dependency, backend, account,
  telemetry or schema change.

## Unresolved Decisions / Uncertainties

- **Wording.** The message is « Étape retirée » and the action « Annuler », as
  given by the backlog. The accessible name of the button is planned to name the
  removed step (for example « Annuler le retrait de … »); confirmation welcome.
- **Focus after removal.** The backlog only requires that removal/restoration not
  lose focus. This plan moves focus to the originating subject's card after a
  removal and to the restored action's « Modifier » control after an undo, reusing
  the existing deferred-focus pattern. Not auto-focusing « Annuler » is
  deliberate, so the countdown is not suspended on every removal.
- **Snackbar placement.** "En bas de l'écran" is read as a fixed bottom region
  outside the re-rendered subject lists, so it survives unrelated re-renders and
  does not cover the lists.
- **DOM coverage.** As in TS-008/TS-009, the repository has no DOM test harness
  and no dependency budget, so deterministic behavior (removal, restore,
  invalidation, ordering and tracking restore) is covered by pure Node tests and
  the DOM/timer wiring is verified manually. Adding a DOM harness would need
  explicit approval.
