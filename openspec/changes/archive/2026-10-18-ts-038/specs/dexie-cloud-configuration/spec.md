# Spec Delta

## MODIFIED Requirements

### Requirement: Local non-synchronized Cloud configuration

ThreadStep SHALL let the user record the Dexie Cloud instance URL in
browser-local storage that is scoped to the origin, is not written to any
synchronized table, and is not included in the JSON document export. Each
synchronized workspace SHALL use a stable base name derived from its normalized
URL, while a legacy configuration keeps its existing base name.

#### Scenario: First configuration stores the validated URL

- **GIVEN** no Dexie Cloud URL is recorded locally
- **WHEN** the user submits a syntactically valid URL
- **THEN** that URL is persisted in local non-synchronized storage

#### Scenario: The stored URL is not synchronized or exported

- **WHEN** a URL has been recorded
- **THEN** it is absent from every synchronized table and from the JSON document export

#### Scenario: Restart reuses the recorded configuration

- **GIVEN** a valid URL is recorded locally
- **WHEN** the application starts again
- **THEN** it reuses that URL without asking for a new configuration

#### Scenario: A second URL receives its own local base

- **GIVEN** a valid URL already recorded with its effective local base name
- **WHEN** a different valid URL is recorded
- **THEN** the new workspace receives a distinct stable base name
- **AND** the previous URL and its base name remain recorded and intact
- **AND** no data is copied between the two workspaces

#### Scenario: Legacy configuration keeps its database name

- **GIVEN** a configuration recorded before per-workspace base names existed
- **WHEN** the workspace registry is initialized
- **THEN** the existing database name is preserved for that URL
- **AND** no local cache is recreated or purged by the migration
