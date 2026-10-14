# Proposal

## Why

ThreadStep users can add, complete and remove actions, but they cannot correct
a title or priority without deleting and recreating the item. Recreating loses
completion status, substeps and the continuity of the same subject, forcing
manual repair. Letting a user fix an existing action in place keeps parallel
subjects trustworthy with minimal effort (FR-10).

## What Changes

- Add a visible, keyboard- and touch-accessible French « Modifier » control to
  every action, including one-level substeps.
- Reveal a compact inline editor prefilled with the current title and priority
  (urgent, normal, later).
- Provide explicit « Enregistrer » and « Annuler » controls; only saving
  mutates and persists data, while cancelling discards the draft.
- Validate the title: trim surrounding whitespace, reject blank or
  whitespace-only titles and trimmed titles longer than 300 characters, without
  corrupting the stored action, and show an understandable validation
  indication.
- Persist only `title` and `priority`; preserve `id`, `done`, `parentId`,
  subject membership and every other action field, plus the
  `threadstep.document.v1` storage shape.
- Keep the existing priority ordering within each hierarchy level and keep
  automatic localStorage persistence and JSON export/import compatible.
- Render edited text through safe text nodes, never injected HTML.

## Capabilities

### New Capabilities

- `action-editing`: Editing the title and priority of an existing action or
  one-level substep while preserving its identity, hierarchy, completion flag
  and locally stored document.

### Modified Capabilities

- None. No canonical specs exist yet, and this change adds the first
  `action-editing` capability without altering another capability's behavior.

## Impact

- `site/core.js`: a new pure update helper with no mutation of its inputs.
- `site/app.js`: edit control, single-editor state and deterministic focus.
- `site/styles.css`: inline editor styling.
- `tests/`: unit tests for the pure update logic.
- No change to the storage key, document version, JSON shape, dependencies,
  network activity or GitHub workflows.

## Non-Goals

- Editing subject names, adding due dates, drag-and-drop, or manual ordering
  within a priority.
- Multi-user features, synchronization, bulk editing and deeper nesting.
- Backend, account, telemetry or new runtime dependencies.

## Unresolved Decisions / Uncertainties

- The 300-character limit is interpreted as measured **after** trimming, which
  matches `parseDocument` (it validates stored, already-trimmed titles) and
  keeps export/import round-trips valid. Confirmation welcome.
- Only one inline editor is open at a time; activating « Modifier » on another
  action replaces the open editor and discards its unsaved draft, since no
  value is stored until « Enregistrer ». Confirmation welcome.
- The exact focus destination after save or cancel is chosen as the edited
  action's « Modifier » control; the precise layout may adapt for mobile.
