# Spec Delta

## MODIFIED Requirements

### Requirement: Automatic cleanup

WHEN the tracked action is completed or removed, or its subject is removed, the
app SHALL clear the stored reference and hide the card, leaving no orphan
reference and producing no error. WHEN such a removal is undone before its undo
window expires and the user has not changed the tracked action since the removal,
the app SHALL restore the previous reference; it MUST NOT restore a reference
invalidated by an explicit later user action.

#### Scenario: Completing the tracked action clears tracking

- **GIVEN** action A is tracked as unfinished
- **WHEN** A is marked done
- **THEN** the reference is cleared and no card is shown

#### Scenario: Removing the tracked action clears tracking

- **GIVEN** action A is tracked
- **WHEN** A is removed from its subject
- **THEN** the reference is cleared, no card is shown and no error occurs

#### Scenario: Removing the tracked action's subject clears tracking

- **GIVEN** action A in subject S is tracked
- **WHEN** subject S is removed
- **THEN** the reference is cleared and no card is shown

#### Scenario: Undoing the removal restores the tracking

- **GIVEN** action A is tracked
- **WHEN** A is removed and the removal is then undone and A becomes unfinished
  and valid again, and no other tracking was chosen
- **THEN** A is tracked again and its card is shown

#### Scenario: Later tracking changes are not overwritten

- **GIVEN** action A is tracked and A is removed
- **WHEN** the user chooses another action B and then undoes A's removal
- **THEN** A's tracking is not restored and B remains tracked
