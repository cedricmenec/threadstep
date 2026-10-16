# Proposal

## Why

A subject can already hold one level of substeps under a top-level action, but a
long subject shows every substep at once, so its structure is harder to scan.
ThreadStep's promise is to make the *next* action obvious; letting the user
temporarily **collapse** a parent's substeps and **expand** them again makes a
subject more readable without losing or changing any work.

## What Changes

- Add a visible French « Replier » / « Déplier » control to every **top-level
  action that has at least one substep visible under the current filters**. No
  control on actions without a visible substep and none on substeps themselves.
- « Replier » hides only that action's substep list; the parent's title,
  priority, completion state, its own controls and the neighbouring actions stay
  visible and usable. « Déplier » restores the substeps in the same order and
  with the same states.
- Collapse is **independent per parent**: several parents, in the same or in
  different subjects, may be collapsed at the same time.
- Collapse is a **transient, tab-local presentation state**: it survives
  ordinary re-renders triggered by normal operations, but a reload, a new tab or
  a JSON import starts again **expanded**. No new document field, no new
  preference and no new storage key.
- Activating the control performs **no save, no `subject.items` mutation, no new
  localStorage entry, no removal, no reorder and no priority or completion
  change**. JSON export and re-import of the same document are unchanged.
- Preserve the existing « Masquer les étapes terminées » filter: expanding never
  reveals a step the filter hides. When the filter leaves no visible substep
  under a parent, its control is absent, while the transient setting of other
  parents is preserved.
- Use an accessible **native `<button>`** (mouse, touch, Tab, Enter, Space) with
  a touch target of at least 44 × 44 px, an accessible name naming the action,
  an exact `aria-expanded`, and an `aria-controls` linked to the substep list
  whenever that list exists. A collapsed list is truly hidden from assistive
  technology and leaves no child control reachable by keyboard. Focus stays
  coherent after activation.
- Do not change the pending counter, the deterministic suggestion, the
  « Je reprends ici » tracking, sorting, editing, completion, reorder controls,
  removal or undo. Hidden substeps still exist and are processed as before.
- Add deterministic Node tests for the pure substep-visibility and
  expansion-state logic, and update the product documentation.

## Capabilities

### New Capabilities

- `substep-collapse`: temporarily hiding and restoring the visible one-level
  substeps of a top-level action with an accessible French disclosure control,
  per parent and only for the current tab, without touching stored data.

### Modified Capabilities

- None. Existing canonical specs (`action-ordering`, `action-removal`,
  `next-action-suggestion`, `resume-tracking`, `action-editing`) keep their
  behavior: collapsing is view-only, so no requirement text changes. Only the
  new `substep-collapse` capability is introduced.

## Impact

- `site/core.js`: a pure, non-mutating helper that computes, for a parent, the
  visible substeps and the render/expansion decision, plus a pure toggle of the
  transient collapsed-parent set.
- `site/app.js`: the tab-local collapsed-parent set, the « Replier » / « Déplier »
  control and its accessible attributes, conditional rendering of the substep
  list, deferred focus after activation, and reset on import.
- `site/styles.css`: control styling with a ≥ 44 × 44 px touch target and a
  visible focus ring, animated only under `prefers-reduced-motion: no-preference`.
- `tests/core.test.mjs`: deterministic tests for children present/absent, two
  independent parents, the completion filter and non-mutation.
- `docs/product/guide-utilisation.md` and `docs/product/mvp.md`: the gesture, its
  tab-local scope and the filter interaction, plus a functional requirement and
  acceptance test.
- Unchanged: document schema and version, `threadstep.document.v1`, JSON shape
  and ids, the `threadstep.resume.v1` preference, dependencies, network activity
  and GitHub workflows.

## Non-Goals / Out of Scope

- Deleting, archiving or completing substeps when collapsing.
- Persisting the collapsed state across reloads, devices or imports.
- More than one nesting level, a « tout replier » control, complex animations or
  a full tree navigation.
- Any change to workflows, factory configuration, authentication or GitHub merge
  rules.

## Unresolved Decisions / Uncertainties

- **Control placement.** The control is planned among the action's existing
  controls (`renderActions`) next to « Modifier » / « + Sous-étape », following
  the current button pattern so it stays clearly identifiable. Exact ordering
  within the row can be confirmed during review without changing the specs.
- **`aria-controls` when collapsed.** Planned: the substep `<ul>` is not rendered
  while collapsed, so `aria-controls` is set only while the list exists, as the
  acceptance criteria allow. Confirmation welcome.
- **External `storage` update.** The spec mandates reset on reload, new tab and
  import. Plan: the collapsed set is reset explicitly on import only; a cross-tab
  `storage` update keeps the current tab's transient state. Confirm if a reset is
  preferred there too.
- **List id source.** Item ids may contain characters unsuitable for an HTML id.
  Plan: generate the list id from a per-render counter (or a sanitized derived
  id) rather than the raw item id. Implementation detail, safe to settle during
  apply.
