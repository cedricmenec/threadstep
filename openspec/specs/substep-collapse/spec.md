# substep-collapse Specification

## Purpose

Lets the user temporarily hide and restore the visible one-level substeps of a
top-level action with an accessible French disclosure control, per parent and
only in the current tab, without changing stored data, ordering or business
rules.

## Requirements

### Requirement: Disclosure control on parents with visible substeps

A top-level action that has at least one substep visible under the current
filters SHALL expose a visible French disclosure control. Actions without a
visible substep, and substeps themselves, MUST NOT expose this control.

#### Scenario: Parent with visible substeps shows the control

- **GIVEN** a top-level action has at least one substep visible under the current
  filters
- **WHEN** the list is rendered
- **THEN** that action shows a visible disclosure control whose label reflects
  the visible substep count

#### Scenario: Parent without visible substeps shows no control

- **GIVEN** a top-level action has no substep
- **WHEN** the list is rendered
- **THEN** that action shows no collapse control

#### Scenario: Substeps show no control

- **GIVEN** a subject displays a one-level substep
- **WHEN** the list is rendered
- **THEN** that substep shows no collapse control, even if it has no children

### Requirement: Native and accessible control

The control SHALL be a native `button` element of `type="button"`, operable with
mouse, touch and keyboard (Tab, Enter, Space), with an accessible name that
includes its current visible label and the parent action's title, and a touch
target of at least 44 × 44 px.

#### Scenario: Keyboard operation

- **GIVEN** a keyboard-only user
- **WHEN** the control receives focus via Tab and is activated with Enter or
  Space
- **THEN** the substeps are collapsed or expanded without a pointer

#### Scenario: Mouse and touch activation

- **WHEN** the control is clicked or tapped
- **THEN** the substeps are collapsed or expanded

#### Scenario: Accessible name names the action

- **WHEN** a control is rendered for an action
- **THEN** its accessible name contains the control's current visible label and
  identifies the parent action

#### Scenario: Touch target large enough

- **WHEN** a control is rendered
- **THEN** its touch target is at least 44 × 44 px

### Requirement: Collapse label shows the visible substep count

When a parent is collapsed, its control's visible label SHALL be
« Voir 1 sous-tâche » for exactly one visible direct substep and
« Voir N sous-tâches » for N (N > 1) visible direct substeps. When the parent is
expanded, the label SHALL be « Masquer les sous-tâches ».

#### Scenario: One visible substep

- **GIVEN** a collapsed parent has exactly one visible direct substep
- **WHEN** the list is rendered
- **THEN** the control's text is exactly « Voir 1 sous-tâche »

#### Scenario: Several visible substeps

- **GIVEN** a collapsed parent has N (N > 1) visible direct substeps
- **WHEN** the list is rendered
- **THEN** the control's text is exactly « Voir N sous-tâches » with the actual
  count

#### Scenario: Expanded label

- **GIVEN** a parent is expanded with at least one visible direct substep
- **WHEN** the list is rendered
- **THEN** the control's text is exactly « Masquer les sous-tâches »

#### Scenario: Toggling updates the label

- **GIVEN** a collapsed parent with two visible direct substeps shows
  « Voir 2 sous-tâches »
- **WHEN** the control is activated
- **THEN** the substeps are shown and the label becomes
  « Masquer les sous-tâches », and a second activation restores
  « Voir 2 sous-tâches »

### Requirement: Count follows the completion filter and child changes

The count SHALL include only the direct substeps visible under the current
« Masquer les étapes terminées » filter, independent of whether those substeps
are themselves collapsed, and SHALL be refreshed on the next render after a
substep is added, removed, restored, completed or filtered.

#### Scenario: Count without the filter

- **GIVEN** a collapsed parent has three direct substeps, one of them completed,
  and « Masquer les étapes terminées » is inactive
- **WHEN** the list is rendered
- **THEN** the label is « Voir 3 sous-tâches »

#### Scenario: Filter reduces the count

- **GIVEN** a collapsed parent has three direct substeps, one of them completed,
  and « Masquer les étapes terminées » is active
- **WHEN** the list is rendered
- **THEN** the label is « Voir 2 sous-tâches » and expanding reveals only the
  unfinished substep

#### Scenario: Count independent of child collapse

- **GIVEN** a collapsed parent has several direct substeps, some of which are
  themselves collapsed
- **WHEN** the list is rendered
- **THEN** the count equals all direct visible substeps regardless of their own
  collapse

#### Scenario: Refreshed after a child change

- **GIVEN** a collapsed parent shows a count for its visible direct substeps
- **WHEN** a direct substep is added, removed, restored or completed
- **THEN** the next render shows the updated count without changing any other
  parent's collapse state

#### Scenario: No control when the filter hides every direct substep

- **GIVEN** the filter hides every direct substep of a parent
- **WHEN** the list is rendered
- **THEN** that parent shows no disclosure control

### Requirement: Collapse hides only that parent's substeps

« Replier » SHALL hide only the substep list of the targeted action while keeping
the parent's title, priority, completion state, its own controls and neighbouring
actions visible and usable. « Déplier » SHALL restore the substeps in the same
order and with the same states.

#### Scenario: Collapse hides children and keeps the parent

- **GIVEN** action A has substeps a1 then a2
- **WHEN** « Replier » is activated on A
- **THEN** a1 and a2 are hidden and A, its priority, its state and its controls
  remain visible and usable

#### Scenario: Expand restores order and state

- **GIVEN** action A is collapsed with substeps a1 then a2
- **WHEN** « Déplier » is activated on A
- **THEN** a1 and a2 are shown again in their initial order with their completion
  states

#### Scenario: Neighbouring actions unaffected

- **WHEN** an action is collapsed or expanded
- **THEN** the neighbouring actions and the subject stay displayed and usable

### Requirement: Independent collapse per parent

Collapsing or expanding one parent SHALL NOT change the collapse state of any
other parent, in the same or in different subjects, and several parents MAY be
collapsed at the same time.

#### Scenario: Two parents have independent states

- **GIVEN** two top-level actions each have visible substeps
- **WHEN** the first is collapsed and the second is left expanded
- **THEN** the first hides its substeps and the second keeps its substeps shown

#### Scenario: Collapse in different subjects is independent

- **GIVEN** two subjects each contain a parent with visible substeps
- **WHEN** a parent in the first subject is collapsed
- **THEN** the parent in the second subject is unchanged

### Requirement: Accessible disclosure state

The control SHALL expose an `aria-expanded` value exactly reflecting the current
state and an `aria-controls` referencing the substep list whenever that list is
rendered. A collapsed list MUST be hidden from assistive technology and MUST
leave no child control reachable by keyboard.

#### Scenario: aria-expanded is exact

- **WHEN** a parent is expanded
- **THEN** its control exposes `aria-expanded="true"`, and `"false"` when the
  parent is collapsed

#### Scenario: aria-controls linked when the list exists

- **GIVEN** a parent is expanded so its substep list is rendered
- **WHEN** the control is examined
- **THEN** its `aria-controls` references that list's identifier

#### Scenario: Collapsed list is hidden and unfocusable

- **GIVEN** a parent is collapsed
- **WHEN** the interface is navigated by keyboard or assistive technology
- **THEN** the substep list is not exposed and no substep control is reachable

### Requirement: Focus and interaction isolation

After activation, keyboard focus SHALL remain on a coherent control for the same
action. Activating the control MUST NOT start a drag, open the editor, toggle
completion or trigger any other action control.

#### Scenario: Focus remains coherent after activation

- **WHEN** a control is activated and the list re-renders
- **THEN** keyboard focus stays on the control for that same action

#### Scenario: No drag or edit triggered

- **GIVEN** a top-level action is displayed
- **WHEN** the collapse control is activated
- **THEN** no drag starts and the inline editor does not open

### Requirement: Transient tab-local state

The collapse state SHALL be local to the current tab and start collapsed. At
document load, on a direct detail entry and on every entry into a view, every
parent with at least one visible substep SHALL be collapsed. The state SHALL
survive ordinary re-renders within the current view and SHALL reset to collapsed
on a change of view, a reload, a new tab and a JSON import. It MUST NOT be
persisted.

#### Scenario: Starts collapsed in the overview after load

- **GIVEN** the document contains a parent with visible substeps
- **WHEN** the overview is loaded
- **THEN** that parent is collapsed and its control shows a « Voir N sous-tâches »
  label

#### Scenario: Starts collapsed on a direct detail entry

- **GIVEN** the document contains a parent with visible substeps
- **WHEN** a valid `#/sujet/<id>` route is loaded directly
- **THEN** the parent is collapsed

#### Scenario: Changing view resets expansion

- **GIVEN** a parent is expanded in the overview
- **WHEN** the user opens the detail view, or returns to the overview, or opens
  another project
- **THEN** every parent of the newly displayed view is collapsed

#### Scenario: Back and Forward reset expansion

- **GIVEN** a parent is expanded in one view
- **WHEN** the user presses Back or Forward to another view
- **THEN** every parent of the newly displayed view is collapsed

#### Scenario: Survives ordinary re-render and save

- **GIVEN** a parent is expanded
- **WHEN** an ordinary operation re-renders the same view, such as editing,
  changing a priority, completing a step, reordering, toggling the filter or a
  notification
- **THEN** that parent stays expanded

#### Scenario: Reset after reload

- **GIVEN** a parent is expanded
- **WHEN** the page is reloaded
- **THEN** every parent is displayed collapsed

#### Scenario: Reset in a new tab

- **GIVEN** a parent is expanded in one tab
- **WHEN** the document is opened in a new tab
- **THEN** every parent is displayed collapsed

#### Scenario: Reset after import

- **GIVEN** a parent is expanded
- **WHEN** a JSON document is imported successfully
- **THEN** every parent is displayed collapsed

### Requirement: Childless parents stay collapsed when a substep is added

A top-level task that had no visible substep SHALL remain collapsed on the
render that first shows an added substep, and a parent that was voluntarily
expanded SHALL keep its expansion when a substep is added. Adding a substep MUST
NOT persist any collapse or expansion state.

#### Scenario: First child starts collapsed

- **GIVEN** a top-level task has no substep
- **WHEN** its first direct substep is added
- **THEN** the task renders collapsed with a « Voir 1 sous-tâche » control and
  the new substep is not focusable

#### Scenario: Expanded parent keeps its expansion on add

- **GIVEN** a parent with visible substeps is expanded
- **WHEN** another direct substep is added
- **THEN** the parent stays expanded and shows the new substep

#### Scenario: Adding writes nothing

- **WHEN** a substep is added
- **THEN** no collapse or expansion state is saved and the exported JSON contains
  only the added item

### Requirement: Temporary expansion to reveal a descendant

When an explicit reveal (« Voir dans la liste », removal undo) targets a direct
substep whose parent is collapsed, the interface SHALL expand that ancestor for
the reveal, show and focus the target, and MUST NOT persist or save the
expansion. A subsequent view entry SHALL reset that expansion to collapsed.

#### Scenario: Revealing a hidden substep expands its parent

- **GIVEN** a direct substep is hidden by a collapsed parent
- **WHEN** an explicit reveal targets that substep
- **THEN** its parent is expanded, the substep is rendered with its reveal cue
  and focus is placed on it

#### Scenario: Revealing a top-level action is unchanged

- **GIVEN** an explicit reveal targets a top-level action
- **WHEN** it is revealed
- **THEN** no ancestor is expanded, the action keeps its reveal cue and focus

#### Scenario: Reveal writes nothing

- **WHEN** a descendant is revealed
- **THEN** no localStorage write occurs and the document, its ids, order,
  priorities, completion flags and parent relations are unchanged

#### Scenario: Next view entry collapses again

- **GIVEN** a parent was temporarily expanded to reveal a descendant
- **WHEN** the user leaves and re-enters the view
- **THEN** every parent of the displayed view is collapsed

### Requirement: No data mutation or persistence

Activating the control MUST NOT save, mutate `subject.items`, change any id,
priority, completion flag, parent relation or order, create a new localStorage
entry or alter the exported JSON, which SHALL remain identical before and after a
simple collapse.

#### Scenario: No save and no storage write

- **WHEN** the control is activated
- **THEN** no localStorage write occurs and no new storage key is created

#### Scenario: Document identical before and after

- **GIVEN** a document is exported and snapshotted
- **WHEN** a parent is collapsed and expanded again
- **THEN** ids, titles, priorities, completion flags, parent relations and item
  order are identical to the snapshot

#### Scenario: Export and import unchanged

- **GIVEN** a collapsed parent
- **WHEN** the document is exported and re-imported
- **THEN** the round-trip preserves the document and starts expanded

### Requirement: Completion filter interaction

WHEN « Masquer les étapes terminées » is active, expanding MUST NOT reveal a
substep the filter hides. WHEN the filter leaves no visible substep under a
parent, its control MUST be absent while the transient collapse setting of other
parents is preserved.

#### Scenario: Expanding never reveals a hidden substep

- **GIVEN** « Masquer les étapes terminées » is active and a parent has a
  completed substep and an unfinished substep
- **WHEN** the parent is expanded
- **THEN** only the unfinished substep is shown and the completed one stays
  hidden

#### Scenario: No control when no visible substep

- **GIVEN** the filter hides every substep of a parent
- **WHEN** the list is rendered
- **THEN** that parent shows no collapse control

#### Scenario: Other parents' settings preserved

- **GIVEN** several parents are collapsed and the filter hides all substeps of
  one of them
- **WHEN** the list is rendered
- **THEN** the collapse setting of the other parents is unchanged

### Requirement: No change to existing business rules

Collapsing or expanding MUST NOT change the unfinished counter, the deterministic
suggestion, the « Je reprends ici » tracking, sorting, editing, completion,
reorder controls, removal or undo; hidden substeps SHALL still exist and be
processed as before.

#### Scenario: Counter and suggestion unchanged

- **GIVEN** a document with a suggested action and a pending count
- **WHEN** a parent is collapsed
- **THEN** the pending count and the suggestion are unchanged

#### Scenario: Tracking unchanged

- **GIVEN** an action is tracked as « Je reprends ici »
- **WHEN** any parent is collapsed or expanded
- **THEN** the tracked action and its card are unchanged

#### Scenario: Hidden substeps still counted and removable

- **GIVEN** a parent with unfinished substeps is collapsed
- **WHEN** the pending count is read and the parent is removed
- **THEN** the hidden substeps are still counted and are removed with the parent
  as before

#### Scenario: Sorting, completion and reorder unaffected

- **WHEN** a parent is collapsed
- **THEN** priority sorting, the completion checkbox and the reorder controls of
  all visible actions behave as before

### Requirement: French and safe text rendering

All labels and accessible names SHALL remain in French, and user-provided action
titles used in accessible names MUST be rendered as text and MUST NOT be
interpreted as HTML.

#### Scenario: Markup shown literally

- **WHEN** an action title contains markup such as
  `<img src=x onerror=alert(1)>` and its collapse control is rendered
- **THEN** the title is treated as text and creates no element
