# Spec Delta

## MODIFIED Requirements

### Requirement: Mandatory configuration before synchronized opening
No synchronized Dexie database SHALL be constructed or opened while no valid local Cloud URL exists. In that situation the application SHALL remain usable in its autonomous local workspace and MUST NOT require a Cloud identity or OTP. When a valid URL does exist, Dexie Cloud SHALL be configured with `requireAuth: true` before any access that opens the synchronized base.

#### Scenario: Missing or invalid URL blocks the synchronized bootstrap
- **GIVEN** no syntactically valid Cloud URL is recorded
- **WHEN** the application starts
- **THEN** no synchronized Dexie instance is constructed or opened
- **AND** the local business workspace is presented and usable
- **AND** no OTP or Cloud identity is required
- **AND** no local business operation is redirected to another storage

#### Scenario: Valid URL configures Cloud before opening
- **GIVEN** a valid URL is recorded
- **WHEN** the synchronized bootstrap runs
- **THEN** Dexie Cloud is configured with that URL before any access that opens the base

#### Scenario: requireAuth is enabled and no other method is offered
- **WHEN** the synchronized base is configured
- **THEN** `requireAuth: true` is passed to Dexie Cloud
- **AND** no alternative authentication mechanism is exposed as a sign-in option

#### Scenario: Local records stay outside the synchronized workspace
- **GIVEN** local business records exist in the autonomous workspace
- **WHEN** a valid Cloud URL is subsequently configured
- **THEN** the synchronized workspace is a distinct database
- **AND** no local record is attached, copied or uploaded by that configuration alone
