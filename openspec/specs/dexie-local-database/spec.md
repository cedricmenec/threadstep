# dexie-local-database Specification

## Purpose

Defines the explicitly versioned Dexie/IndexedDB base used by ThreadStep, its
globally unique synchronized identifiers, its non-destructive upgrades and its
stable, Cloud-suffixed database selection.

## Requirements

### Requirement: Explicitly versioned schema with unique identifiers

ThreadStep SHALL use Dexie.js as the access layer and SHALL declare an explicit
schema version whose synchronized stores use globally unique string primary keys.
A synchronized store MUST NOT use the auto-incremented `++id` key.

#### Scenario: Explicit version declared before opening

- **WHEN** the local database schema is declared
- **THEN** it carries an explicit version number
- **AND** that declaration happens before the base is opened

#### Scenario: Synchronized stores use unique identifiers

- **WHEN** a synchronized store is declared
- **THEN** its primary key is a globally unique string identifier and not `++id`

#### Scenario: No synchronized store uses an auto-incremented key

- **WHEN** the complete declared schema is inspected
- **THEN** no synchronized store declares `++id`

### Requirement: Non-destructive schema evolution

A new application version that changes the local schema SHALL use the Dexie
versioning and upgrade mechanism, SHALL declare any required migration
explicitly, and MUST NOT delete existing data implicitly to resolve a schema
incompatibility.

#### Scenario: New version uses the versioning mechanism

- **WHEN** a release introduces a schema change
- **THEN** a new explicit Dexie version and its upgrade are declared

#### Scenario: Existing data is not deleted implicitly

- **GIVEN** an existing local base with data
- **WHEN** a schema upgrade runs
- **THEN** no existing record is implicitly deleted and no base is recreated

### Requirement: Stable name and native nameSuffix selection

The synchronized Dexie database name SHALL stay stable across releases, the
autonomous local workspace SHALL use a distinct stable database name, and the
native `nameSuffix` MUST NOT be disabled. Selecting a different Dexie Cloud URL
SHALL select a distinct IndexedDB base without deleting the previous base or
copying data between bases.

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

### Requirement: Dedicated local workspace without Cloud addon

The autonomous local workspace SHALL be opened on its dedicated stable database
with the same explicit schema version and `subjects`/`items` string-key stores as
the synchronized schema. It MUST be opened without the Dexie Cloud
synchronization addon, without `db.cloud.configure()` and without an
auto-incremented `++id` key.

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
