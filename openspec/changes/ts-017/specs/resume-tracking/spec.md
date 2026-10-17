# Spec Delta

## ADDED Requirements

### Requirement: Reveal a tracked action beyond the overview preview

WHEN the tracked action is not among the five visible top-level tasks previewed on
its overview card, activating « Voir dans la liste » SHALL open the detail view of
the tracked action's subject and reveal the tracked action there, keeping the
stored tracking reference unchanged. It MUST NOT attempt to target, scroll to or
focus an element that is absent from the overview.

#### Scenario: Tracked action beyond the preview

- **WHEN** the tracked action is not among the five previewed entries
- **THEN** the detail view of its subject opens and the tracked action is revealed

#### Scenario: Tracked action within the preview

- **WHEN** the tracked action is among the five previewed entries
- **THEN** it is revealed in the overview as before

#### Scenario: Tracking reference is unchanged

- **WHEN** the reveal is used for a tracked action beyond the preview
- **THEN** the tracked reference and its local preference are unchanged

#### Scenario: No command targets an absent element

- **WHEN** the tracked action is beyond the preview
- **THEN** no scroll or focus targets an element that is not in the overview DOM
