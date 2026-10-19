# Spec Delta

## MODIFIED Requirements

### Requirement: Local persistence and restore
The tracked reference SHALL be stored in a per-workspace, origin-scoped IndexedDB metadata store that is never synchronized and never exported. It SHALL be restored after a reload without network access, keyed by the stable subject and action identifiers, never by title or list position. A legacy `threadstep.resume.v1` value SHALL be migrated idempotently before it stops being read.

#### Scenario: Reload restores the tracked action
- **GIVEN** action A is tracked
- **WHEN** the page is reloaded in the same browser
- **THEN** the card for A is restored from the local IndexedDB metadata store without a network request

#### Scenario: Renaming and reordering do not break tracking
- **GIVEN** action A is tracked
- **WHEN** A is renamed, reprioritized or its subject is reordered and the page is reloaded
- **THEN** A remains tracked and the card shows its updated title, priority and subject

#### Scenario: No tracking after a clean session
- **GIVEN** the user never defined a tracked action
- **WHEN** the page is reloaded
- **THEN** no « Je reprends ici » card is shown

#### Scenario: Legacy preference is migrated once
- **GIVEN** a valid `threadstep.resume.v1` value exists and the metadata store has no preference
- **WHEN** the workspace is opened
- **THEN** the reference is written to the local metadata store and survives reload
- **AND** the legacy key is not deleted automatically
- **AND** a second migration attempt does not duplicate or overwrite the stored reference

#### Scenario: Metadata write failure keeps the legacy value
- **GIVEN** a valid legacy preference and an unavailable or failing metadata write
- **WHEN** the migration is attempted
- **THEN** the failure is reported as a local storage error
- **AND** the legacy value remains intact and readable
- **AND** the preference is not reported as durably stored

#### Scenario: Workspace isolation
- **GIVEN** two workspaces with different local databases
- **WHEN** the tracked action is read in each workspace
- **THEN** each workspace uses only its own metadata store
- **AND** no reference is copied or synchronized between workspaces

### Requirement: JSON export/import compatibility
Tracking MUST NOT change the modern backup shape or add a preference field. Imports MUST accept a valid modern IndexedDB backup without tracking data, MUST reject a `version: 1` document, and SHALL clear the reference when the imported records no longer contain the tracked action.

#### Scenario: Older export stays importable
- **GIVEN** a valid modern IndexedDB backup
- **WHEN** it is imported
- **THEN** it is accepted and the business records are read from the modern format
- **AND** no preference field is required or interpreted

#### Scenario: Preference lives outside the document
- **GIVEN** a `version: 1` document
- **WHEN** it is imported
- **THEN** the import is refused without write
- **AND** the tracked preference is left unchanged

#### Scenario: Exported JSON has no tracking data
- **GIVEN** an action is tracked
- **WHEN** the user exports the workspace
- **THEN** the modern backup contains no tracking field or metadata store content
- **AND** the exported records are identical to the business records

#### Scenario: V1 document is refused
- **GIVEN** a `version: 1` document
- **WHEN** it is imported
- **THEN** the import is refused without write
- **AND** the tracked preference is left unchanged

#### Scenario: Import without the tracked action clears it
- **GIVEN** action A is tracked
- **WHEN** a valid modern backup that does not contain A is imported
- **THEN** the reference is cleared and no card is shown
