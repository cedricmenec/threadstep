# Spec Delta

## Purpose

Defines the frontend security boundary of the delivered ThreadStep bundle: no
machine secrets, administrative credentials or imposed Cloud URL, reproducible
dependency assets with no runtime CDN, and a strict CSP limited to Dexie Cloud.

## ADDED Requirements

### Requirement: No secrets or imposed URL in the bundle

The delivered frontend MUST NOT contain a Dexie Cloud machine secret, an
administrative token or credential, the files `dexie-cloud.key` and
`dexie-cloud.json`, or any user Dexie Cloud URL imposed at build time. The
synchronization URL SHALL be read from the local user configuration at runtime.

#### Scenario: No machine secret or administrative token

- **WHEN** the frontend sources and the static build are inspected
- **THEN** no machine secret, administrative credential or administrative token is present

#### Scenario: Dexie CLI files are excluded

- **WHEN** the delivered assets are inspected
- **THEN** `dexie-cloud.key` and `dexie-cloud.json` are absent from every distributed resource

#### Scenario: No imposed URL

- **WHEN** the static build is inspected
- **THEN** no Dexie Cloud instance URL is hardcoded
- **AND** the URL is obtained at runtime from the local user configuration

### Requirement: Reproducible assets without a runtime CDN

Dexie.js and dexie-cloud-addon SHALL be delivered as pinned, reproducible local
assets. The running page MUST NOT load a third-party CDN script or depend on a
third-party network resource at runtime, and it SHALL keep working when served
from the repository subpath.

#### Scenario: Pinned local assets

- **WHEN** the client dependencies are delivered
- **THEN** their exact pinned versions are used from local assets

#### Scenario: No runtime CDN

- **WHEN** the page is loaded
- **THEN** it references no third-party CDN script and needs no third-party runtime resource

#### Scenario: Subpath compatibility

- **WHEN** the site is served from the repository subpath
- **THEN** its assets resolve through relative paths and load correctly

### Requirement: Strict CSP allowlist for Dexie Cloud

The Content Security Policy SHALL replace `connect-src 'none'` with an allowlist
limited to the Dexie Cloud HTTPS and WebSocket hosts needed for authentication
and synchronization, and MUST NOT allow any other connection origin.

#### Scenario: connect-src is no longer 'none'

- **WHEN** the served HTML is inspected
- **THEN** its `connect-src` directive is no longer `'none'`

#### Scenario: Only Dexie Cloud hosts are allowed

- **WHEN** the `connect-src` allowlist is inspected
- **THEN** it allows only the Dexie Cloud HTTPS/WSS hosts
- **AND** it contains no broader wildcard or unrelated origin

#### Scenario: No connection outside the allowlist

- **WHEN** the synchronized base is used
- **THEN** no connection is made to an origin outside the declared allowlist
