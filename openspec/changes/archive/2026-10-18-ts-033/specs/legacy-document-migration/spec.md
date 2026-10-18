# Spec Delta

## MODIFIED Requirements

### Requirement: Explicit consent before any synchronized import
The application MUST NOT write historical data into synchronized tables before
an explicit user confirmation. Refusing MUST leave both the source and the cloud
data untouched.

#### Scenario: No write before confirmation

- **WHEN** a valid historical document exists and consent has not been given
- **THEN** no record derived from it is written to any synchronized table

#### Scenario: Refusal is non-destructive

- **WHEN** the user declines the migration
- **THEN** the `threadstep.document.v1` value is unchanged
- **AND** the JSON export of the historical document remains available
- **AND** no synchronized or remote data is added, changed or removed

#### Scenario: Local conversion does not require a Cloud consent

- **GIVEN** a valid historical document and an autonomous local workspace
- **WHEN** the user explicitly confirms a local conversion
- **THEN** the conversion may write only to the local IndexedDB workspace
- **AND** no configured Dexie Cloud destination, session or synchronized write is required
- **AND** this consent gate remains required for any later synchronized import
