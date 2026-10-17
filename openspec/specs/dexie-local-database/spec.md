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

The Dexie database name SHALL stay stable across releases and the native
`nameSuffix` MUST NOT be disabled. Selecting a different Dexie Cloud URL SHALL
select a distinct IndexedDB base without deleting the previous base or copying
data between the two.

#### Scenario: Stable database name across upgrades

- **WHEN** the application is upgraded
- **THEN** the Dexie database name used for the local base is unchanged

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
