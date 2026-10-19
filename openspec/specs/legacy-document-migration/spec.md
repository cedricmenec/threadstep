# legacy-document-migration Specification

## Purpose

Converts the historical `localStorage` V1 document into the synchronized Dexie
tables only after explicit consent, atomically, idempotently and without ever
losing, erasing or silently overwriting the user's existing data.

## Requirements

### Requirement: Historical V1 document support is retired

The application SHALL NOT detect, offer, convert, import or restore the historical `threadstep.document.v1` document. Its presence MUST NOT trigger a synchronized write, a local conversion, a migration panel or a V1 export. The stored value MUST remain intact until an explicit, scoped cleanup and MUST NOT be replaced by a `legacy:` identifier heuristic.

#### Scenario: Legacy document is inert

- **GIVEN** a valid `threadstep.document.v1` value exists
- **WHEN** the application starts, reloads, authenticates, synchronizes or goes offline
- **THEN** no migration is offered or executed
- **AND** the business view is fed only by IndexedDB
- **AND** no synchronized or local record is written from the legacy value
- **AND** the key is left untouched

#### Scenario: Legacy document cannot be imported or restored

- **GIVEN** a `version: 1` document or a file produced from the V1 key
- **WHEN** it is presented to an import or restore action
- **THEN** it is refused explicitly with no write
- **AND** no conversion or identifier mapping is attempted
- **AND** the source file and the current workspace remain intact

#### Scenario: No legacy reader remains

- **WHEN** the user-facing import, restore, export and migration paths are inspected
- **THEN** none reads the V1 document shape as a supported source
- **AND** the only remaining access to the legacy key is the cleanup inventory
- **AND** the inventory does not parse its value into business records

