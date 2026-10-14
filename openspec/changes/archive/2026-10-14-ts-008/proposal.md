# Proposal

## Why

After an interruption, a detour or a context switch, people juggling parallel
subjects must rescan every list to find the action they had deliberately chosen.
TS-007 helps decide with a deterministic suggestion; TS-008 records the human
choice so the exact next action is immediately visible when they come back,
without a network round-trip.

## What Changes

- Add a French « Garder le fil » control on every **unfinished top-level**
  action to define it as the action being resumed. The control MUST be
  keyboard- and touch-operable and MUST expose an accessible name.
- Allow exactly **one** tracked action per document. Choosing another replaces
  the previous one without modifying any action, ID, priority, completion flag
  or order.
- Show a top-of-interface « Je reprends ici » card with the subject name, action
  title and priority, plus « Voir dans la liste » and « Ne plus suivre ».
- Persist the reference locally in a preference **separate** from
  `threadstep.document.v1`, keyed by the stable subject ID and action ID (never
  the title or list position), and restore it after reload without network.
- Reveal the tracked action by reusing the existing focus/highlight mechanism of
  TS-007, including on mobile and when « Masquer les étapes terminées » is on.
- Clear the reference automatically when the tracked action is completed or
  removed, or its subject is removed, leaving no orphan reference; keep it
  unchanged across title/priority edits and subject reordering.
- Keep the TS-007 suggestion independent: asking for a suggestion does not
  change the tracked action.

## Capabilities

### New Capabilities

- `resume-tracking`: pin one unfinished top-level action as the current
  « Je reprends ici », persist the reference as a browser-local preference,
  reveal it accessibly, replace or clear it, and clean it up safely.

### Modified Capabilities

- None. This introduces a new capability only; the existing
  `next-action-suggestion` and `action-editing` requirements do not change.

## Impact

- `site/core.js`: new `RESUME_KEY` constant and pure helpers
  (`resumeView`, `parseResumePreference`, `serializeResumePreference`) that never
  mutate their input.
- `site/app.js`: preference load/save/clear, reconciliation on load and after
  mutations, pin controls, resume card rendering and reveal reuse.
- `site/index.html`, `site/styles.css`: a dedicated `#resume-card` region near
  the top of the interface and control/card styling.
- `tests/core.test.mjs`: unit tests for the pure helpers and compatibility.
- `docs/product/mvp.md`: FR-13 wording and acceptance tests for the delivered
  behavior.
- Unchanged: document schema/version, `threadstep.document.v1` storage key, JSON
  import/export files, GitHub Pages URLs, dependencies, workflows and factory
  policy.

## Non-Goals / Out of Scope

- Several tracked actions, history, time spent, Pomodoro, reminders,
  notifications, in-app AI and multi-device synchronization.
- Tracking substeps in this first version.
- Changing IDs, priorities, completion flags or ordering when tracking.
- New runtime dependencies, backend, account, telemetry or network access.

## Unresolved Decisions / Uncertainties

- **Control wording.** The backlog offers both « Garder le fil » and
  « Reprendre cette action ». This plan uses visible « Garder le fil » with an
  accessible name containing the action title, while the card title
  « Je reprends ici » conveys resuming. Confirmation welcome.
- **Tracked-state affordance.** The tracked action's control is planned as an
  announced status (« Action suivie », disabled) rather than an `aria-pressed`
  toggle, because pressing a toggle again would imply an unspecified
  "unpin on second press" behavior. Clearing stays on the card's
  « Ne plus suivre ». Confirmation welcome.
- **Card placement.** "En haut de l'interface" is read as the first block of the
  working area, above the unfinished counter and the subject lists.
- **Automated DOM coverage.** The repository has no DOM test harness and no
  dependency budget (`AGENTS.md` forbids new dependencies), so this plan covers
  selection, replacement, reload round-trip, orphan cleanup and TS-007
  independence with pure unit tests and verifies DOM wiring (card, reveal,
  cleanup triggered by UI) manually. Confirm if a minimal DOM harness is desired;
  adding one would require explicit approval.
- **Orphan handling.** The plan deletes the stored preference as soon as it no
  longer resolves to a valid action, rather than only hiding the card, matching
  the backlog wording "supprimer proprement la référence".
