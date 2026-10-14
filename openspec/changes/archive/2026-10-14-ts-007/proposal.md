# Proposal

## Why

With several active subjects, deciding what to resume next requires scanning
every list. One deterministic, one-tap suggestion gives a concrete next action
without browsing, reinforcing ThreadStep's core value of knowing what to do next
(FR-12) while staying local, small and offline.

## What Changes

- Add a visible, keyboard- and touch-accessible French « Une étape pour
  maintenant » control near the global unfinished counter.
- Activating it computes exactly one eligible unfinished **top-level** action
  from the current in-memory document and shows a compact, non-modal focus card
  with the subject name, action title and priority.
- Selection is deterministic: urgent before normal before later; for equal
  priority, earlier subject order, then earlier underlying item order. No
  randomness, dates, network requests or AI.
- Only unfinished top-level actions are eligible. Completed actions, all
  substeps and completed parents with unfinished children are excluded.
- When no eligible top-level action exists, show a friendly French empty state
  instead of a broken card.
- Provide a « Voir dans la liste » control that brings the suggested action into
  view with keyboard-accessible focus or a visible highlight, including mobile.
- Keep the suggestion view-only: recompute from current state on each
  activation, never write localStorage, never persist the card across reload.

## Capabilities

### New Capabilities

- `next-action-suggestion`: deterministic, view-only suggestion of one
  unfinished top-level action plus an accessible way to locate it in the list.

### Modified Capabilities

- None. No canonical spec requirement is changing; this introduces a new
  capability only.

## Impact

- `site/core.js`: new pure selection helper with no mutation of its input.
- `site/app.js`: control wiring, in-memory suggestion state, non-modal card and
  reveal/focus behavior.
- `site/index.html`, `site/styles.css`: control markup, card and highlight
  styling.
- `tests/core.test.mjs`: unit tests for the selector and empty-state cases.
- `docs/product/mvp.md`: document FR-12 behavior and its limits.
- Unchanged: document schema/version, `threadstep.document.v1` storage key, JSON
  import/export, GitHub Pages URLs, dependencies, workflows and factory policy.

## Non-Goals

- AI-generated or random suggestions, rotation, timers, Pomodoro, notifications
  or due dates.
- Substep-level recommendations, automatic completion, editing or reordering
  from the card.
- Storing the last suggestion, cross-device sync, backend, account, telemetry
  or new runtime dependencies.
- Changing the storage key, document version or export/import shape.

## Unresolved Decisions / Uncertainties

- Priority is treated as the dominant ranking key (urgent globally before
  normal, then subject order, then item order), matching the backlog wording.
  Confirmation welcome.
- "Earlier underlying item order" is read as the raw `subject.items` array
  order (storage order), not the displayed priority-sorted order.
- The reveal uses the action's existing « Modifier » control as the focus
  destination plus a visible highlight, since the backlog allows "focus or a
  visible highlight".
- A small « Fermer » affordance is included so the non-modal card can be
  dismissed; this is a UI detail, not a new product requirement.
