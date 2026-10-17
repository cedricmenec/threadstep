# Proposal

## Why

Task and substep rows are tall because every command (« Modifier », « Retirer »,
« + Sous-étape », « Promouvoir en tâche principale », « Garder le fil »,
« Monter », « Descendre ») is rendered inline, so a list is hard to scan on both
desktop and mobile. TS-023 makes each row denser by keeping only the primary
controls visible and grouping the secondary commands in one accessible
per-item actions menu, without losing any action, keyboard alternative or
accessibility.

## What Changes

- **Compact rows**: the overview and the detail view use a tighter vertical
  rhythm for rows, margins, buttons and action areas while preserving the
  TS-020 parent/substep hierarchy cues, multiline notes and their line breaks,
  and the existing contrast. Long titles and narrow viewports must not overlap
  or overflow horizontally.
- **Directly visible primary controls**: the completion checkbox, the title,
  the interactive priority badge-selector, the drag handle (when sorting is
  allowed), the « Voir N sous-tâches » disclosure control and a new « ⋮ »
  menu button stay visible and directly usable on the row.
- **Per-item actions menu**: a native « ⋮ » button of at least 44 × 44 px with
  the accessible name « Actions pour [titre] » opens a menu that groups the
  applicable commands: « Modifier », « Retirer », « Ajouter une sous-tâche »
  (parent only), « Promouvoir en tâche principale » (direct substep only,
  reusing TS-022), « Garder le fil » / the tracked state (unfinished parent
  only) and the accessible reordering commands « Monter » / « Descendre » when
  applicable. Non-applicable commands are absent or disabled with a clear
  indication and no command is duplicated on the row.
- **Keyboard reordering alternative preserved**: the two « Monter » and
  « Descendre » buttons leave the visible row, but remain available in the menu
  with the same same-subject / same-parent / same-priority restrictions, the
  same disabled boundaries and no drag gesture required. The project reorder
  arrows are untouched.
- **Accessible menu behavior**: consistent `aria-expanded`, opening and closing
  with mouse, touch, Enter, Space and Escape, predictable Tab navigation,
  closing on outside click, view change and after a command, focus returned to
  the menu button, one open menu at a time, and no storage write or drag start
  when opening or closing.
- **Same behavior for the moved commands**: they keep their existing
  validations, ordering restrictions, notifications, persistence and undo
  operations; the priority selector keeps its real 44 × 44 px interactive area
  and its three values.
- **No new business status**, no JS dependency, no business data, no storage,
  and no change to the JSON export, routes or selection rules. Titles are never
  injected through `innerHTML`.

### Non-goals

- A global design overhaul, menus on project cards, removal of keyboard
  alternatives, additional business statuses, a drag-and-drop rewrite or a
  component library.

## Capabilities

### New Capabilities

- `task-actions-menu`: a per-item actions menu that groups the applicable
  secondary commands behind an accessible « ⋮ » disclosure while the primary
  controls stay directly visible, preserving every existing validation,
  restriction, persistence and undo behavior.

### Modified Capabilities

- `task-hierarchy-presentation`: a new compact-row requirement and an updated
  « Controls, focus and touch targets preserved » requirement so that primary
  controls stay directly findable while the edit, add, reorder and remove
  commands are exposed through the per-item actions menu.
- `action-editing`: the « Modifier » command is exposed through the per-item
  actions menu instead of being rendered inline; the editing behavior itself is
  unchanged.
- `action-ordering`: the accessible « Monter » / « Descendre » controls are
  exposed through the per-item actions menu; the same-subject, same-priority
  scope and boundary rules are unchanged and the drag handle stays visible.
- `substep-ordering`: the substep drag handle stays visible while the
  « Monter » / « Descendre » controls are exposed through the per-item actions
  menu; the same-parent, same-priority scope and boundary rules are unchanged.
- `resume-tracking`: the « Garder le fil » command is exposed through the
  per-item actions menu instead of being rendered inline; tracking behavior is
  unchanged.
- `substep-promotion`: the « Promouvoir en tâche principale » command is exposed
  through the per-item actions menu instead of being rendered inline; the
  promotion behavior delivered by TS-022 is unchanged.

## Impact

- `site/core.js`: a small pure command-descriptor helper so the menu's
  presence/absence rules are deterministic and unit-testable; no document,
  item, storage or export shape changes.
- `site/app.js`: the per-item « ⋮ » menu, its open/close state and focus
  management, and the move of the secondary controls into it, in the shared
  `renderItem`/`renderActions` path used by both the overview and the detail
  view.
- `site/styles.css`: compact row spacing and the menu presentation, without
  reducing interactive surfaces or the hierarchy cues.
- `tests/`: new deterministic unit tests for the pure command model and new
  static-assertion tests over `site/app.js`/`site/styles.css`, plus existing
  non-regression suites.
- `docs/product/mvp.md` and `docs/product/guide-utilisation.md`: updated in the
  same apply PR to describe the compact rows and the « ⋮ » menu, including the
  keyboard reordering alternative. This planning change does not edit them.

## Uncertainties

- **Menu placement**: the backlog does not prescribe a floating popover. This
  plan chooses an inline disclosure panel inside the task item so it cannot be
  clipped at a screen edge, needs no repositioning script and keeps a natural
  Tab order. This is an implementation decision, not a new product rule.
- **Menu semantics**: the backlog only requires a native button, a coherent
  `aria-expanded` and a predictable Tab order. This plan therefore uses a
  disclosure of native buttons rather than an ARIA `menu`/`menuitem` widget,
  whose arrow-key and roving-focus contract is not required here.
- **Menu state after a command**: this plan closes the menu after every command
  and returns focus to the menu button unless the command itself moves focus
  (opening the editor, revealing a promoted or tracked item). The backlog asks
  to manage the state but does not fix a single policy.
- **Exact compact spacing values** are implementation details, not product
  decisions; the requirement is only that rows get noticeably denser without
  overlap, overflow or reduced touch targets.
- **« Ajouter une sous-étape »** keeps its existing `prompt()` flow; the backlog
  moves the command into the menu without asking to redesign the substep
  creation dialog.
- **Reachability of menu commands inside a collapsed parent**: as today, the
  commands of a substep are reachable only once its parent is expanded; no new
  behavior is assumed.
