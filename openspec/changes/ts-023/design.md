# Design

## Context

See `proposal.md` — Why. The V1 document is
`{ version: 1, subjects: [ { id, title, items: [ { id, title, priority, done,
parentId, note? } ] } ] }`. `parentId: null` marks a top-level task; a non-null
`parentId` points at a top-level item and is the only nesting level allowed by
`parseDocument`. Rendering lives in `site/app.js`: `renderItem` appends
`renderRow` (checkbox, title, priority control), an optional note, then
`renderActions`, and finally the child `ul` when the parent is expanded.
`renderActions` currently renders `renderReorderControls` (the drag handle plus
the « Monter » / « Descendre » buttons), then the promotion, disclosure,
« Modifier », « + Sous-étape », « Garder le fil » and « Retirer » controls
inline. `renderRow` already renders the completion checkbox, the title and the
interactive priority control. The overview and the detail view share this exact
path. There is no DOM test runner in this repository: DOM wiring is covered by
Node unit tests on `site/core.js` plus static source assertions against
`site/app.js` and `site/styles.css`.

## Goals / Non-Goals

**Goals:**
- One deterministic, unit-testable description of which commands apply to an
  item, so presence/absence and disabled states are provable in Node.
- Move the secondary commands into a single accessible per-item menu while the
  primary controls stay on the row.
- Keep the existing command handlers and domain functions untouched; no
  duplicated business logic and no new document/storage shape.
- Compact the row spacing with CSS only, preserving hierarchy cues, notes,
  touch targets and reduced-motion behavior.

**Non-Goals:**
- A floating/popover menu with collision handling, arrow-key navigation or an
  ARIA `menu` widget.
- Any change to priorities, completion, ordering semantics, promotion
  semantics, counters, suggestion, tracking, removal/undo, notes, routes or the
  JSON export.
- Any new dependency, storage key, document field or business status.

## Decisions

### Decision: a pure command-descriptor helper in `site/core.js`

Add `itemMenuCommands(item, options)` returning an ordered array of
`{ id, label, disabled }` descriptors, where `options` is
`{ tracked = false, canMoveUp = false, canMoveDown = false }`. The rules read
only `item.parentId` and `item.done` plus the options, and never mutate the
item. Order: `edit`, `remove`, `add-substep` (top-level only), `promote`
(direct substep only), `keep-track` (unfinished top-level only, labelled
« Action suivie » and disabled when `tracked`), `move-up`, `move-down`. This
mirrors the existing pure-function style (`planRemoval`, `canMoveWithinPriority`)
and gives the tests a deterministic target for "actions applicables". The
alternative — building the command list inline in `app.js` — was rejected
because a source string match is weaker evidence than a pure function whose
exact output can be asserted.

### Decision: inline disclosure menu instead of a floating popover

The menu is a `div` panel rendered inside the task `li`, opened by the native
« ⋮ » button and containing native buttons. It is a disclosure of buttons, not
an ARIA `menu`/`menuitem` widget. Rationale: no clipping at screen edges, no
repositioning script, a natural Tab order, and mobile-safe behavior; the
backlog only requires a native button, a coherent `aria-expanded` and a
predictable Tab order. Alternative considered: an absolutely positioned popover;
rejected for edge/overflow complexity and the added pointer logic.

### Decision: keep the primary controls on the row, move the secondary ones

`renderRow` keeps the checkbox, the title and the priority control unchanged.
The drag handle and the disclosure control stay directly visible in
`renderActions`. Only `Modifier`, `Retirer`, `+ Sous-étape`, `Promouvoir en
tâche principale`, `Garder le fil` and `Monter` / `Descendre` move into the
menu, so the row height drops. The disclosure control keeps its own
`aria-expanded`/`aria-controls` contract and the priority control keeps its
44 × 44 px interactive area.

### Decision: one open menu tracked by `openMenuId`, reset on view entry

Add a single `openMenuId` state. Opening sets it, closing clears it. Escape,
an outside click, a change of view (the existing `hashchange` / `isViewEntry`
path), and any activated command close it. `render()` re-creates the DOM, so
the menu is rebuilt from `openMenuId`; a re-render triggered by an unrelated
operation preserves the open menu of the same item, matching the existing
"survives ordinary re-render" pattern used for collapse. Opening or closing
never calls `persist()`. Because the menu button is not a drag handle, a
`pointerdown` on it never starts a drag.

### Decision: reuse every existing command handler

The menu buttons call the same handlers as before: the editor toggle,
`retirerAction`, the substep-add `prompt()` flow, `promoteItemToTopLevel` via
the existing reveal path, the `resumeRef` pin, and `moveItem` for
« Monter » / « Descendre ». No domain logic is copied into the menu. Commands
that re-render or move focus close the menu first; the existing focus flags
(`focusItemId`, `pendingMoveFocus`, `pendingPriorityFocus`, `focusRenameControl`)
continue to drive focus, with `applyFocus` extended only to return focus to the
menu button after a close without another target.

### Decision: compact CSS without a new breakpoint

Tighten `.task`, `.task-actions`/`.task-menu`, `.children .task` and the detail
view equivalents; keep `white-space: pre-wrap` for notes, keep the `.children`
indent + border guide and the typographic scale, keep `min-width/min-height:
44px` on every interactive control and the `:focus-visible` outline. No new
media query is introduced; the existing `max-width:620px` block is updated if
needed.

### Decision: test strategy without a DOM runner

Extend `tests/core.test.mjs` with `itemMenuCommands` cases and add a
`tests/task-actions-menu.test.mjs` (or equivalent) of static assertions over
`site/app.js`/`site/styles.css`: the « ⋮ » label, `aria-expanded`, the
`openMenuId` state, the Escape/outside-click/view-reset wiring, the absence of
`persist()` in the toggle path, the removal of the inline move buttons, the
preserved primary controls and compact rules. Cross-feature non-regression
reuses the existing suites. Real browser keyboard, touch, screen-reader and
visual behavior stays in Manual acceptance.

## Risks / Trade-offs

- [Moving the move buttons into the menu reduces discoverability] → Keep the
  drag handle visible, label the menu commands explicitly, keep them disabled at
  the boundaries with the existing indication, and state the keyboard
  alternative in the user guide; covered by static assertions and Manual
  acceptance.
- [Focus is lost when a menu closes] → `applyFocus` returns focus to the menu
  button when no other target applies; static assertions cover the wiring and
  Manual acceptance covers the real browser.
- [Compact spacing could shrink touch targets] → Keep every interactive control
  at ≥ 44 × 44 px; static assertions check the `min-width/min-height` rules and
  Manual acceptance checks real devices.
- [Menu left open across a re-render or view change] → Reset `openMenuId` on a
  view entry and close on outside click; a same-view re-render rebuilds the open
  menu deterministically from `openMenuId`.
- [Accidental data write on open/close] → The toggle path calls neither
  `persist()` nor any core mutation; a static assertion forbids `persist()` in
  the toggle handler and the pure command helper never mutates its input.
- [Blocking `prompt()` for « Ajouter une sous-étape »] → Unchanged existing
  behavior, kept out of scope; it is invoked only after the menu closes.

## Migration Plan

No migration: the exported JSON, `threadstep.document.v1`, the routes and every
stored field keep their shape and version. Deployment is the normal static PR to
`main` plus GitHub Pages; rollback is reverting the PR, which leaves any stored
document valid because the change is presentation-only.

## Open Questions

None that affect the specs, the approach or the task breakdown. The menu
placement and the close-after-command policy are recorded as decisions, not
deferred unknowns.
