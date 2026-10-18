# Spec Delta

## MODIFIED Requirements

### Requirement: Stable name and native nameSuffix selection
The synchronized Dexie database name SHALL stay stable across releases, the autonomous local workspace SHALL use a distinct stable database name, and the native `nameSuffix` MUST NOT be disabled. Selecting a different Dexie Cloud URL SHALL select a distinct IndexedDB base without deleting the previous base or copying data between bases.

#### Scenario: Stable database name across upgrades
- **WHEN** the application is upgraded
- **THEN** the synchronized Dexie database name used for the local base is unchanged
- **AND** the autonomous local workspace keeps its own unchanged database name

#### Scenario: nameSuffix preserved
- **WHEN** Dexie Cloud is configured
- **THEN** `nameSuffix` is not disabled and the native per-instance suffix stays applied

#### Scenario: Same URL reselects the same base
- **GIVEN** a Dexie Cloud URL already used by this application
- **WHEN** it is selected again
- **THEN** the same suffixed IndexedDB base is reselected
- **AND** no data is copied and no new base is created for the same URL

#### Scenario: Different URL keeps the previous base intact
- **WHEN** a different Dexie Cloud URL is confirmed
- **THEN** a distinct IndexedDB base is selected
- **AND** the previous IndexedDB base remains intact
- **AND** no data is copied between the two bases

#### Scenario: Local and synchronized databases are distinct
- **GIVEN** an autonomous local workspace containing records
- **WHEN** a synchronized workspace is selected
- **THEN** its database name differs from the autonomous local database name
- **AND** the local records remain in the local workspace

## ADDED Requirements

### Requirement: Dedicated local workspace without Cloud addon
The autonomous local workspace SHALL be opened on its dedicated stable database with the same explicit schema version and `subjects`/`items` string-key stores as the synchronized schema. It MUST be opened without the Dexie Cloud synchronization addon, without `db.cloud.configure()` and without an auto-incremented `++id` key.

#### Scenario: Local open without synchronization
- **GIVEN** no Cloud configuration is active
- **WHEN** the local workspace is opened
- **THEN** no Dexie Cloud addon is installed or configured
- **AND** no synchronization or authentication state is created

#### Scenario: Local schema remains Cloud-compatible
- **WHEN** the local workspace schema is inspected
- **THEN** it carries the explicit versioned schema
- **AND** `subjects` and `items` use stable string identifiers
- **AND** no store uses `++id`
- **AND** no local record is placed in the synchronized workspace

#### Scenario: Local schema upgrade preserves data
- **GIVEN** an existing local workspace with records
- **WHEN** a compatible schema version is opened
- **THEN** the upgrade does not delete or recreate existing records
- **AND** no empty workspace is presented in place of readable data
