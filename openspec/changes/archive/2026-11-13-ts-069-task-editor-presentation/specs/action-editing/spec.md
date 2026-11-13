# Spec Delta

## ADDED Requirements

### Requirement: Inline editor is visually distinct
The inline action editor SHALL use a softly tinted surface, a subtle border, rounded corners and internal spacing so the active editing area is distinguishable from neighboring task rows. It MUST preserve the existing fields, controls, order and interaction behavior, and MUST follow the focus and scroll continuity contract.

#### Scenario: Editor appears as a distinct editing area
- **GIVEN** an action is shown in a task list
- **WHEN** the user opens its inline editor
- **THEN** the editor is visually separated from neighboring task rows while remaining in the same list position
- **AND** its title, priority, note, save and cancel controls remain available in their existing order

#### Scenario: Editor remains contained on a narrow viewport
- **GIVEN** the inline editor is displayed in a narrow viewport
- **WHEN** the title, note, validation message or controls require additional space
- **THEN** the editor wraps its existing contents within the available width without horizontal page overflow or clipping
- **AND** the current form values and task-list scroll context remain unchanged
