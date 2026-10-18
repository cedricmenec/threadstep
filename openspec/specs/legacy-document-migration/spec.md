# legacy-document-migration Specification

## Purpose

Converts the historical `localStorage` V1 document into the synchronized Dexie
tables only after explicit consent, atomically, idempotently and without ever
losing, erasing or silently overwriting the user's existing data.

## Requirements

### Requirement: Historical V1 document detection and strict validation

The application SHALL detect the stored `threadstep.document.v1` document and
SHALL validate it strictly with the existing `parseDocument` rules before any
migration. An absent, unreadable or invalid document MUST NOT trigger a
migration.

#### Scenario: A valid historical document is detected

- **WHEN** a `threadstep.document.v1` value that satisfies `parseDocument` exists in local storage
- **THEN** the application recognizes it as a migratable historical document

#### Scenario: An invalid historical document is not migrated

- **WHEN** the stored value fails `parseDocument` validation
- **THEN** no migration is offered or executed
- **AND** the stored value is left untouched
- **AND** a comprehensible message reports that the document is unusable

#### Scenario: No historical document

- **WHEN** no `threadstep.document.v1` value is present or storage is unavailable
- **THEN** no migration is proposed
- **AND** no synchronized write is attempted

### Requirement: Preservation of full historical content and hierarchy

A migrated document SHALL preserve subjects, items, business identifiers,
`parentId` parentage, notes, priorities, order, `done` states and the local
resume preference, reproducing the same exported V1 content after conversion.

#### Scenario: Rich document is migrated without loss

- **GIVEN** a valid V1 document with subjects, nested substeps, notes, mixed priorities, `done` flags and a resume preference
- **WHEN** the confirmed migration completes
- **THEN** every subject, item, id, `parentId`, note, priority, order and `done` value is present in the target
- **AND** an export of the migrated base reproduces the original V1 content

#### Scenario: The local resume preference is preserved

- **WHEN** a resume preference existed before the migration
- **THEN** it remains available to the local tracking behavior
- **AND** it is not written into a synchronized table

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

### Requirement: Migration destination and effect disclosure

Before requesting consent, the application SHALL present the migration
destination, the data to be transferred and the future synchronization effect,
so the user understands that the data will become cloud-synchronized.

#### Scenario: Disclosure precedes consent

- **WHEN** the migration prompt is shown
- **THEN** it identifies the configured Dexie Cloud destination
- **AND** it summarizes the data to be transferred
- **AND** it states that the transferred data will be synchronized
- **AND** consent is requested only after this disclosure

### Requirement: Atomic migration

The confirmed migration SHALL apply all derived records in a single operation
set. If validation or the write transaction fails, no partial migration MUST
remain and the target MUST be unchanged.

#### Scenario: A successful migration is a single operation set

- **WHEN** the confirmed migration is applied
- **THEN** all derived records are committed as one atomic operation set

#### Scenario: A failed transaction leaves no partial data

- **WHEN** the migration transaction fails midway
- **THEN** no partial historical record remains in the target
- **AND** the target keeps its previous state
- **AND** the historical source remains intact

### Requirement: Idempotent migration and collision handling

The migration SHALL be idempotent per target base: re-running it MUST NOT
duplicate records, and an identifier collision or an already-migrated document
SHALL be detected and resolved without silent duplication or loss.

#### Scenario: Re-running does not duplicate

- **GIVEN** a document already migrated into the target base
- **WHEN** the migration is run again
- **THEN** no subject or item is duplicated
- **AND** the resulting projection is identical to the already-migrated state

#### Scenario: Identifier collision is detected

- **WHEN** a legacy identifier already exists in the target with different content
- **THEN** the collision is detected before writing
- **AND** the migration does not silently overwrite the existing record
- **AND** a comprehensible outcome is reported to the user

### Requirement: Populated target base is not silently overwritten

When the target base already contains business records, the migration MUST NOT
replace them silently. The application SHALL build an explicit reconciliation
plan that preserves existing records and may insert only the independent source
records that are genuinely absent. The user SHALL be informed of the inventory
and the decision SHALL be explicit; no overwrite or destructive default is
allowed.

#### Scenario: Non-empty target prompts a decision

- **GIVEN** the target base already holds subjects or items
- **WHEN** a historical document is available for migration
- **THEN** the application does not overwrite the existing records without an explicit decision
- **AND** it reports the existing target data and the reconciliation inventory

#### Scenario: Existing target data survives a refused decision

- **WHEN** the user does not confirm a migration into a non-empty target
- **THEN** the existing target records are unchanged
- **AND** the historical source remains unchanged

#### Scenario: Independent missing groups can be inserted

- **GIVEN** a populated target and a confirmed reconciliation plan
- **WHEN** some source subjects and steps are absent and independent from every conflict
- **THEN** only those absent independent records are inserted
- **AND** identical, conflicting and Cloud-only records are not overwritten

### Requirement: Stable legacy identifier mapping

When the synchronized `@id` strategy requires remapping legacy identifiers, the
mapping SHALL be deterministic, stable across runs and injective, and it SHALL
remap `parentId` references and the resume preference consistently while
preserving the V1 export identifiers.

#### Scenario: Parent references follow the mapping

- **WHEN** legacy identifiers are remapped for synchronized keys
- **THEN** every `parentId` reference is remapped to the same key as its parent
- **AND** the relationship is preserved after the migration

#### Scenario: Mapping is stable across runs

- **WHEN** the same legacy identifier is mapped more than once
- **THEN** the mapped key is identical every time
- **AND** re-running the migration does not create a second record for it

### Requirement: No implicit cross-base transfer on URL change

Changing the configured Dexie Cloud URL MUST NOT import or copy historical or
target data from one base into another.

#### Scenario: New URL does not import the previous base

- **WHEN** the user configures a different Dexie Cloud URL
- **THEN** no historical document is automatically migrated into the new base
- **AND** no record is copied from the previous base into the new one

#### Scenario: Migration is bound to the disclosed destination

- **WHEN** consent was given for one destination and the destination changes before the write
- **THEN** the migration aborts instead of writing into the changed destination
- **AND** both the source and the bases remain unchanged

### Requirement: Non-destructive failure and source retention

On refusal, interruption, exception or an invalid destination, the historical
document SHALL remain present, readable and exportable, the old key MUST NOT be
erased and the target or cloud data MUST NOT be overwritten.

#### Scenario: An exception preserves the source

- **WHEN** an unexpected error occurs during the migration
- **THEN** the historical document is not deleted or rewritten
- **AND** it remains readable and exportable
- **AND** the target data is not partially overwritten

#### Scenario: Interruption is recoverable

- **WHEN** the migration is interrupted before completion
- **THEN** the historical source remains available
- **AND** a later confirmed attempt can complete without duplication

#### Scenario: Source and export remain usable after any attempt

- **WHEN** any migration attempt ends, whether accepted or refused
- **THEN** the `threadstep.document.v1` source remains usable
- **AND** the JSON export of the historical document still works
