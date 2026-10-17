# Spec Delta

## ADDED Requirements

### Requirement: Locate a suggested action beyond the overview preview

WHEN the suggested action is not among the five visible top-level tasks previewed
on its overview card, activating « Voir dans la liste » SHALL open the detail view
of that action's subject and reveal the action there. It MUST NOT attempt to
target, scroll to or focus an element that is absent from the overview, and it
MUST NOT modify the stored document, ids, priorities or ordering.

#### Scenario: Suggested action beyond the preview

- **WHEN** the suggested action is not among the five previewed entries
- **THEN** the detail view of its subject opens and the action is revealed

#### Scenario: Suggested action within the preview

- **WHEN** the suggested action is among the five previewed entries
- **THEN** it is revealed in the overview as before

#### Scenario: No command targets an absent element

- **WHEN** the suggested action is beyond the preview
- **THEN** no scroll or focus targets an element that is not in the overview DOM

#### Scenario: Reveal stays view-only

- **WHEN** the reveal is used for a suggestion beyond the preview
- **THEN** the document, localStorage and the exported JSON are unchanged
