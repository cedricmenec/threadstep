# Spec Delta

## MODIFIED Requirements

### Requirement: Populated target base is not silently overwritten

When the target base already contains business records, the migration MUST NOT
replace them silently. The application SHALL build an explicit reconciliation
plan that preserves existing records and may insert only the independent source
records that are genuinely absent. The user SHALL be informed of the inventory
and the decision SHALL be explicit; no overwrite or destructive default is
allowed.

#### Scenario: Non-empty target prompts a decision

- **GIVEN** the target base already holds subjects or items
- **WHEN** a historical document is available for migration
- **THEN** the application does not overwrite the existing records without an explicit decision
- **AND** it reports the existing target data and the reconciliation inventory

#### Scenario: Existing target data survives a refused decision

- **WHEN** the user does not confirm a migration into a non-empty target
- **THEN** the existing target records are unchanged
- **AND** the historical source remains unchanged

#### Scenario: Independent missing groups can be inserted

- **GIVEN** a populated target and a confirmed reconciliation plan
- **WHEN** some source subjects and steps are absent and independent from every conflict
- **THEN** only those absent independent records are inserted
- **AND** identical, conflicting and Cloud-only records are not overwritten
