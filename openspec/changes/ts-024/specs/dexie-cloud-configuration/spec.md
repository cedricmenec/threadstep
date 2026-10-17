# Spec Delta

## Purpose

Defines how ThreadStep records, validates and reuses the local Dexie Cloud
instance URL, and how it gates every synchronized database access behind a
mandatory, network-independent configuration step without losing existing local
data.

## ADDED Requirements

### Requirement: Local non-synchronized Cloud configuration

ThreadStep SHALL let the user record the Dexie Cloud instance URL in
browser-local storage that is scoped to the origin, is not written to any
synchronized table, and is not included in the JSON document export. A stable
database name is used regardless of the configured URL.

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

### Requirement: Purely syntactic HTTPS validation

Validation SHALL happen before the URL is used, SHALL require an HTTPS URL
compatible with Dexie Cloud, and MUST NOT perform any network request, so a
configured database can still be recognized while the service is unreachable. A
URL that is not HTTPS, is malformed or embeds credentials MUST be rejected.

#### Scenario: Valid HTTPS URL accepted offline

- **GIVEN** the device has no network access
- **WHEN** a valid HTTPS Dexie Cloud URL is validated
- **THEN** it is accepted without any network request

#### Scenario: Non-HTTPS or malformed URL rejected

- **WHEN** the input is not an absolute HTTPS URL, is malformed or embeds credentials
- **THEN** it is rejected with an understandable message and nothing is recorded

#### Scenario: Unreachable service does not change the syntactic result

- **GIVEN** the configured service is unreachable
- **WHEN** the URL is validated
- **THEN** the syntactic result is identical to the offline result and no connection is attempted

### Requirement: Mandatory configuration before synchronized opening

No synchronized Dexie database SHALL be constructed or opened, and no Dexie
business operation SHALL run, while no valid local URL exists; in that case an
accessible configuration screen SHALL be presented. When a valid URL does exist,
Dexie Cloud SHALL be configured, with `requireAuth: true`, before any access that
opens the synchronized base.

#### Scenario: Missing or invalid URL blocks the synchronized bootstrap

- **GIVEN** no syntactically valid URL is recorded
- **WHEN** the application starts
- **THEN** no synchronized Dexie instance is constructed or opened
- **AND** an accessible configuration screen is presented
- **AND** no Dexie business operation is executed

#### Scenario: Valid URL configures Cloud before opening

- **GIVEN** a valid URL is recorded
- **WHEN** the synchronized bootstrap runs
- **THEN** Dexie Cloud is configured with that URL before any access that opens the base

#### Scenario: requireAuth is enabled and no other method is offered

- **WHEN** the synchronized base is configured
- **THEN** `requireAuth: true` is passed to Dexie Cloud
- **AND** no alternative authentication mechanism is exposed as a sign-in option

### Requirement: Unreachable service without data loss

When the configured URL is syntactically valid but the service is unreachable,
ThreadStep SHALL signal the connection or synchronization problem and MUST NOT
delete the local configuration or the existing IndexedDB bases. A previously
authorized base SHALL remain available according to the applicable native Dexie
Cloud authentication and access conditions.

#### Scenario: Connection problem is signaled

- **GIVEN** a valid URL is configured and the service is unreachable
- **WHEN** the application tries to synchronize
- **THEN** an appropriate connection or synchronization error is presented

#### Scenario: Configuration is preserved

- **GIVEN** the service is unreachable
- **WHEN** the failure is reported
- **THEN** the recorded URL is retained

#### Scenario: Existing base remains available

- **GIVEN** a synchronized base was previously authorized on this device
- **WHEN** the service becomes unreachable
- **THEN** no IndexedDB base is deleted
- **AND** the previously authorized base remains available under the applicable Dexie Cloud conditions
