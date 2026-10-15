# Spec Delta

## Purpose

Removing a top-level action or a one-level substep immediately, and offering a
short, local, non-modal window to undo that single removal exactly.

## ADDED Requirements

### Requirement: Immediate removal and persistence

Activating the existing « Retirer » control SHALL remove the targeted action and,
for a top-level action, all of its substeps, then persist the document to the
existing browser-local storage immediately. It MUST NOT show a blocking
confirmation dialog and MUST NOT defer the storage write.

#### Scenario: Removing a top-level action and its substeps

- **WHEN** the user activates « Retirer » on a top-level action that has substeps
- **THEN** the action and all of its substeps disappear at once and the document
  is saved

#### Scenario: Removing a single substep

- **WHEN** the user activates « Retirer » on a substep
- **THEN** only that substep disappears and its sibling substeps remain

#### Scenario: No blocking confirmation

- **WHEN** the user activates « Retirer »
- **THEN** no modal confirmation dialog is shown before the removal

### Requirement: Undo snackbar

After a removal the app SHALL show a discreet, non-modal snackbar at the bottom
of the screen containing the French message « Étape retirée » and an « Annuler »
button. The snackbar MUST NOT block other operations and MUST be announced
through a non-intrusive live region.

#### Scenario: Snackbar shows message and action

- **WHEN** an action is removed
- **THEN** a snackbar with the text « Étape retirée » and an « Annuler » button is
  shown

#### Scenario: Other operations remain possible

- **GIVEN** a removal is pending
- **WHEN** the user completes an action, toggles the completed filter or adds
  another action
- **THEN** those operations succeed and the pending undo window continues

#### Scenario: Message is announced

- **WHEN** the snackbar appears
- **THEN** its message is exposed through a `role="status"` (or equivalent)
  live region without stealing focus

#### Scenario: Undo button has an accessible name

- **WHEN** the snackbar is shown
- **THEN** the « Annuler » control exposes an accessible French name naming the
  removed step

### Requirement: Ten-second undo window

The undo window SHALL last ten seconds from the removal, driven by a cancellable
timer with no polling and no network access. Without interaction the snackbar
SHALL close automatically at expiry and the undo SHALL expire.

#### Scenario: Automatic close

- **WHEN** ten seconds pass without the user activating « Annuler »
- **THEN** the snackbar closes and no further undo is offered

#### Scenario: No polling or network

- **WHEN** the undo window is open
- **THEN** the countdown uses a cancellable timer only, with no repeated polling
  and no network request

#### Scenario: Unrelated re-render keeps the window

- **GIVEN** a removal is pending
- **WHEN** the interface re-renders for an unrelated reason
- **THEN** the snackbar and its remaining countdown are preserved

### Requirement: Exact restore of the removed subtree

Activating « Annuler » before expiry SHALL restore the removed action with any
substeps exactly as removed — same `id`, title, priority, `done`, `parentId` and
original position in the subject's item array — and SHALL persist the document
immediately so exports and later reloads reflect the restoration.

#### Scenario: Restore a parent and its children

- **WHEN** the user removes a top-level action with substeps and activates
  « Annuler » before expiry
- **THEN** the action and every substep return with unchanged identities,
  priorities, completion flags, parent relations and order

#### Scenario: Restore a single substep

- **WHEN** the user removes one substep and activates « Annuler »
- **THEN** that substep returns to its original position and its siblings are
  unchanged

#### Scenario: Restoration is persisted

- **WHEN** a removal is undone
- **THEN** the browser-local document is saved again and a subsequent JSON export
  contains the restored action

#### Scenario: Activation after expiry restores nothing

- **GIVEN** the undo window has expired
- **WHEN** « Annuler » is activated
- **THEN** no data is restored

### Requirement: Preserve changes made meanwhile

Restoring a removal MUST preserve every unrelated change made between the removal
and the undo, and MUST NOT drop items added meanwhile, recreate a removed
subject, or overwrite newer data.

#### Scenario: Additions survive the undo

- **WHEN** the user removes an action, adds another action to the same subject,
  then activates « Annuler »
- **THEN** the removed action returns and the added action is still present

#### Scenario: Edits survive the undo

- **WHEN** the user removes an action, edits another action, then activates
  « Annuler »
- **THEN** the edit is preserved and only the removed action is restored

### Requirement: Single reversible removal

At most one removal SHALL be reversible at a time. A new removal SHALL close the
previous undo window and replace the snackbar, and « Annuler » MUST restore only
the most recent removal.

#### Scenario: New removal replaces the window

- **GIVEN** removal of action A is pending
- **WHEN** the user removes action B
- **THEN** the snackbar shows B's removal and A can no longer be restored

#### Scenario: Only the last removal is restored

- **GIVEN** removal of A was replaced by removal of B
- **WHEN** « Annuler » is activated
- **THEN** only B is restored and A stays removed

### Requirement: Invalidation of a pending undo

A pending undo SHALL be discarded, without restoring anything and without
recreating data, when its subject is removed, when a JSON import replaces the
document, or when another tab replaces the stored data through the `storage`
event.

#### Scenario: Subject removal invalidates

- **GIVEN** removal from subject S is pending
- **WHEN** subject S is removed
- **THEN** the pending undo is discarded and no data is restored

#### Scenario: Import invalidates

- **GIVEN** a removal is pending
- **WHEN** a valid JSON import replaces the document
- **THEN** the pending undo is discarded and the imported document is kept

#### Scenario: External update invalidates

- **GIVEN** a removal is pending
- **WHEN** another tab replaces the stored document through the `storage` event
- **THEN** the pending undo is discarded and the newer data is kept

#### Scenario: A removed subject is never recreated

- **WHEN** an invalidation occurs
- **THEN** no subject, action or substep is recreated and no newer data is
  overwritten

### Requirement: Tab-local and non-persistent undo

The undo window SHALL be local to the current tab and temporary. Reloading or
closing the page MUST NOT restore the removed action, and the feature MUST NOT
create a persistent trash, history or a new browser-storage key.

#### Scenario: Reload does not restore

- **GIVEN** a removal is pending
- **WHEN** the page is reloaded within the undo window
- **THEN** the action stays removed and no snackbar appears

#### Scenario: No new storage key

- **WHEN** the change ships and removals are made
- **THEN** no browser-storage key other than the existing document and resume
  keys is created

### Requirement: Whole-subject removal unchanged

Removing an entire subject SHALL keep its existing confirmation dialog and MUST
NOT use this snackbar or undo in this change. The import confirmation MUST also
stay unchanged.

#### Scenario: Subject deletion still confirms

- **WHEN** the user removes a subject
- **THEN** the existing confirmation is shown and no undo snackbar is offered

#### Scenario: Import still confirms

- **WHEN** the user starts an import that replaces the document
- **THEN** the existing confirmation is shown

### Requirement: Coherence with other features

After a removal and after an undo, the pending count, the completed-items filter,
the deterministic suggestion and JSON export/import SHALL remain coherent with the
current document.

#### Scenario: Counter and suggestion follow the document

- **WHEN** an action is removed and then restored
- **THEN** the pending count and the next suggestion reflect the restored
  document, not a stale state

### Requirement: Accessible and mobile-safe snackbar

The removal and undo controls SHALL be keyboard- and touch-operable, focus SHALL
not be lost by a removal or an undo, the snackbar SHALL sit above the mobile safe
area with a comfortable touch target, the countdown SHALL pause while keyboard
focus is inside the snackbar and resume afterwards, and any animation SHALL
respect `prefers-reduced-motion`.

#### Scenario: Keyboard operation

- **WHEN** a keyboard-only user removes an action and activates « Annuler »
- **THEN** both steps are possible without a pointer and focus stays on a
  sensible control

#### Scenario: Focus is not lost

- **WHEN** an action is removed and then restored
- **THEN** keyboard focus is placed on a deterministic, visible control instead of
  being lost

#### Scenario: Countdown pauses on focus

- **GIVEN** the snackbar is shown
- **WHEN** keyboard focus moves into the snackbar
- **THEN** the expiration is suspended and resumes when focus leaves

#### Scenario: Mobile safe area and touch target

- **GIVEN** a mobile viewport with a bottom safe area
- **WHEN** the snackbar is shown
- **THEN** it stays visible above the safe area and its button is comfortably
  tappable without covering the list permanently

#### Scenario: Reduced motion honored

- **GIVEN** `prefers-reduced-motion` is enabled
- **WHEN** the snackbar appears or disappears
- **THEN** no non-essential animation is played

#### Scenario: Safe text rendering

- **WHEN** a removed action's title contains markup such as
  `<img src=x onerror=alert(1)>`
- **THEN** the snackbar text is rendered as a text node and creates no element
