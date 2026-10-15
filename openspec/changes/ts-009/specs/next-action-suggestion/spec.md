# Spec Delta

## MODIFIED Requirements

### Requirement: Suggestion card content

WHEN an eligible action exists, the app SHALL show exactly one compact,
non-modal card with that action's subject name, action title and priority, plus
a short French explanation of why that action was selected. The explanation MUST
name the effective priority and MUST state the existing tie-break order of
earlier subject order then earlier action order. It MUST NOT change the
selection or introduce any criterion beyond that order.

#### Scenario: Card shows the suggested action

- **WHEN** an eligible action is suggested
- **THEN** the card shows its subject name, its title and its priority and no
  second action

#### Scenario: Explanation names the effective priority

- **GIVEN** an eligible suggested action whose priority is urgent, normal or
  later
- **WHEN** the card is shown
- **THEN** the explanation names that same priority in French

#### Scenario: Explanation states the tie-break order

- **WHEN** the card is shown
- **THEN** the explanation states that, for equal priority, earlier subject order
  then earlier action order decides, and names no other criterion

#### Scenario: No explanation without a suggestion

- **WHEN** no eligible action exists
- **THEN** no explanation and no suggestion card are shown
