# substep-promotion Specification

## Purpose

Lets the user promote one direct substep to a top-level task in its same subject
through an explicit accessible command, preserving its identity, content,
priority and completion state while keeping the other children and the stored V1
document coherent.

## Requirements

### Requirement: Promotion command on direct substeps

Every rendered direct substep (`parentId` not `null`) SHALL expose a French
« Promouvoir en tâche principale » command through its per-item actions menu in
both the overview and the detail view. A top-level task (`parentId: null`) MUST
NOT expose it, and promotion MUST NOT create a second substep level.

#### Scenario: Overview substep shows the command

- **WHEN** a subject displays a direct substep in the overview
- **THEN** that substep offers a « Promouvoir en tâche principale » command in its actions menu

#### Scenario: Detail view substep shows the command

- **WHEN** a subject displays a direct substep in the detail view
- **THEN** that substep offers the same promotion command in its actions menu as in the overview

#### Scenario: Top-level task shows no command

- **WHEN** a subject displays a top-level task
- **THEN** no promotion command is offered for that task

#### Scenario: No second nesting level

- **WHEN** a direct substep is promoted
- **THEN** no second substep level is created and no other item changes level

### Requirement: Promotion changes only the parent relation

Activating the command SHALL set only the targeted item's `parentId` to `null`,
in its same subject, without recreating the object or generating a new id. `id`,
`title`, `priority`, `done`, the optional `note` and every other valid field MUST
be preserved; sibling substeps MUST stay attached to the former parent and no
item is duplicated, moved to another subject or deleted.

#### Scenario: Fields are preserved

- **WHEN** a substep carrying a note, a non-default priority or a completed state
  is promoted
- **THEN** it becomes a top-level task of the same subject with the same `id`,
  `title`, `priority`, `done` and `note`, and only `parentId` becomes `null`

#### Scenario: Identity is not recreated

- **WHEN** a substep is promoted
- **THEN** its `id` is unchanged and no new item object or identifier is created

#### Scenario: Siblings stay attached

- **WHEN** a parent has several substeps and one of them is promoted
- **THEN** the other substeps keep their `parentId` pointing to the former parent

#### Scenario: No duplication or cross-subject move

- **WHEN** a substep is promoted
- **THEN** it appears exactly once, in its original subject, and no other subject
  is modified

### Requirement: Deterministic position after the former parent

The promoted item SHALL be inserted in `subject.items` immediately after its
former parent without changing the relative order of the other elements.
Rendering SHALL keep the primary Urgent / Normal / Plus tard order then the
manual order inside each group, and promotion MUST NOT change any priority.

#### Scenario: Inserted immediately after the former parent

- **GIVEN** a parent P with direct substeps a and b in that order
- **WHEN** a is promoted
- **THEN** a is placed in `subject.items` immediately after P and b keeps its
  position

#### Scenario: Other relative order is unchanged

- **WHEN** any substep is promoted
- **THEN** every other item keeps its relative position in the array

#### Scenario: Priority is never changed by promotion

- **WHEN** a substep is promoted
- **THEN** its priority and every other item's priority are unchanged

#### Scenario: Rendering still follows priority then manual order

- **GIVEN** a promoted item of a given priority
- **WHEN** the subject is rendered
- **THEN** it appears in its Urgent / Normal / Plus tard group at the manual
  position defined by the array

### Requirement: Single save and refusal of invalid promotions

A valid promotion SHALL cause exactly one local save. An unknown subject or item
id, an item already top-level, or a missing or incoherent parent MUST be refused
without writing, and a promotion already performed MUST NOT replay.

#### Scenario: A valid promotion writes once

- **WHEN** a valid promotion is activated
- **THEN** exactly one local save occurs

#### Scenario: Unknown id is refused

- **WHEN** the targeted subject or item id does not exist
- **THEN** nothing is written and the document is unchanged

#### Scenario: Already top-level is refused

- **WHEN** the targeted item is already a top-level task
- **THEN** nothing is written and the document is unchanged

#### Scenario: Missing or incoherent parent is refused

- **WHEN** the target's parent is absent, is itself a substep, or is the item
  itself
- **THEN** nothing is written and the document is unchanged

#### Scenario: Replay is a no-op

- **WHEN** promotion is requested again for an already promoted item
- **THEN** the same document reference is returned and no second save occurs

### Requirement: Immediate coherence with existing features

After promotion the lists, the top-level task total (+1), the pending counter
(unchanged), the overview five-entry preview, the completed filter, « Je reprends
ici » and « Une étape pour maintenant » SHALL reflect the new hierarchy. A
promoted unfinished task becomes eligible for the functions reserved for
top-level tasks, and removing the former parent MUST keep the promoted task.

#### Scenario: Total increases and pending counter is unchanged

- **WHEN** a substep is promoted
- **THEN** the subject's top-level total increases by one and the pending counter
  is unchanged

#### Scenario: Promoted task becomes eligible

- **GIVEN** a promoted task that is not completed
- **WHEN** the interface renders it
- **THEN** it is eligible for the deterministic suggestion and for
  « Je reprends ici », like any other unfinished top-level task

#### Scenario: Preview and filter reflect the hierarchy

- **WHEN** a promotion changes which tasks are top-level
- **THEN** the overview five-entry preview and the completed filter recompute
  from the promoted document

#### Scenario: Removing the former parent keeps the promoted task

- **WHEN** the former parent is removed after a promotion
- **THEN** the promoted task is not removed

#### Scenario: Former parent loses the disclosure control

- **GIVEN** the former parent has no other visible substep after the promotion
- **WHEN** the list is rendered
- **THEN** that parent shows no substep disclosure control

### Requirement: Accessible command and restored focus

The command SHALL be operable by keyboard, mouse and touch, with a French
accessible name naming the substep, a touch target of at least 44 × 44 px and a
visible focus state. After a promotion, an accessible focus or marker SHALL be
kept on the promoted task, opening the detail view when it falls outside the
overview preview instead of targeting an absent element.

#### Scenario: Keyboard and touch operation

- **WHEN** a keyboard user focuses and activates the control, or a touch user
  taps it
- **THEN** the promotion is performed without using another control

#### Scenario: Accessible name names the substep

- **WHEN** a promotion control is rendered for a substep
- **THEN** its accessible name contains the French label and the substep title as
  text

#### Scenario: Focus is restored in the overview

- **GIVEN** a promoted task that stays within the overview preview
- **WHEN** the promotion completes
- **THEN** focus or a visible marker is placed on the promoted task

#### Scenario: Focus via the detail view beyond the preview

- **GIVEN** a promoted task that is not among the five overview entries
- **WHEN** the promotion completes
- **THEN** the detail view of its subject opens and the promoted task is revealed
  there

#### Scenario: No command targets an absent element

- **WHEN** the promoted task is beyond the preview
- **THEN** no focus or scroll targets an element that is absent from the overview
  DOM

### Requirement: V1 persistence and compatibility

Promotion MUST NOT change the document version, the
`threadstep.document.v1` storage key or the JSON shape. A reload, a JSON
export/import round-trip and the existing removal/undo, edit, note and reorder
rules MUST keep working, and no migration or new storage key SHALL be
introduced.

#### Scenario: Reload retains the promotion

- **WHEN** a promotion is saved and the page is reloaded
- **THEN** the promoted task is restored as a top-level task

#### Scenario: Export and import round-trip

- **WHEN** a document with a promoted task is exported and re-imported
- **THEN** the task keeps `parentId: null` and every other field, with version 1

#### Scenario: Removal undo keeps the promoted task

- **WHEN** another item is removed and the removal is undone
- **THEN** the promoted task keeps its top-level position and fields

#### Scenario: No new version or storage key

- **WHEN** promotion ships and is used
- **THEN** `threadstep.document.v1` and the version stay unchanged and no new
  storage key is created

### Requirement: Immediate action and safe text

Promotion SHALL apply immediately without a blocking confirmation dialog, because
no data is destroyed, and this scope adds no inverse « rétrograder » operation.
User-provided titles used in accessible names MUST be rendered as text nodes and
MUST NOT be interpreted as HTML.

#### Scenario: No blocking confirmation

- **WHEN** the promotion control is activated
- **THEN** the promotion applies immediately with no modal confirmation

#### Scenario: No demotion control

- **WHEN** an item is displayed, whether top-level or a substep
- **THEN** no inverse demotion control is offered

#### Scenario: Markup shown literally

- **WHEN** a substep title contains markup such as
  `<img src=x onerror=alert(1)>`
- **THEN** the accessible name contains it as literal text and creates no
  element
