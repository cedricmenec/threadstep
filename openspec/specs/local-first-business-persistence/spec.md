# local-first-business-persistence Specification

## Purpose

Defines how ThreadStep persists and mutates subjects and steps in a
transactional, local-first IndexedDB store: local write confirmation independent
of the network, distinct local-failure reporting, cross-tab coherence,
fine-grained entity granularity, atomic JSON V1 import/export, non-synchronized
preferences and a non-destructive guard preserving historical V1 data.

## Requirements

### Requirement: Transactional local-first business writes

Every business mutation SHALL be applied through a Dexie/IndexedDB transaction,
and a write SHALL be considered recorded locally as soon as that transaction
commits, without waiting for a Dexie Cloud acknowledgement. The interface SHALL
distinguish local recording from remote synchronization and MUST NOT imply a
pending remote synchronization when Cloud is not activated.

#### Scenario: A local-only write is confirmed on commit

- **GIVEN** l'espace local autonome est ouvert sans Cloud
- **WHEN** l'utilisateur enregistre une mutation métier hors ligne
- **THEN** la transaction IndexedDB est validée sans accès réseau
- **AND** l'interface confirme l'enregistrement sur cet appareil après le commit
- **AND** elle n'annonce ni synchronisation en attente ni transfert distant

#### Scenario: An offline write is confirmed on commit

- **GIVEN** the synchronized store was initialized and a session allows local access
- **WHEN** the device is offline and the user saves a business mutation
- **THEN** the transaction commits without network access
- **AND** the interface confirms the write as recorded on this device
- **AND** the change remains pending remote synchronization

#### Scenario: No remote acknowledgement is required

- **WHEN** a mutation commits locally
- **THEN** the local recorded confirmation is produced without any Dexie Cloud acknowledgement

#### Scenario: A later synchronization failure does not retract the local confirmation

- **WHEN** a local transaction commits and a subsequent synchronization attempt fails
- **THEN** the local recorded status is kept
- **AND** only a synchronization state is reported as failing

### Requirement: Local storage failure is not success

When an IndexedDB transaction fails, the operation MUST NOT be presented as
recorded, an explicit local persistence error SHALL be shown, and that error
SHALL be distinct from a network or synchronization error.

#### Scenario: A failed transaction is reported as unsaved

- **WHEN** an IndexedDB transaction fails
- **THEN** the operation is not presented as recorded
- **AND** an explicit local persistence error is shown

#### Scenario: A local failure is distinct from a network failure

- **WHEN** a local transaction fails
- **THEN** the reported failure kind differs from a synchronization or network failure
- **AND** no success status is produced

#### Scenario: A failed transaction leaves no partial mutation

- **WHEN** a transaction fails midway
- **THEN** no partial mutation remains persisted
- **AND** the previous local state is unchanged

### Requirement: Fine-grained syncable subject and step entities

Subjects and steps SHALL be stored as separate records with globally unique
stable identifiers, preserving `parentId`, order, `priority`, `done` and `note`.
A mutation of one entity MUST NOT rewrite unrelated whole-document records, so
concurrent edits to distinct items do not overwrite each other.

#### Scenario: Independent edits to distinct steps are not overwritten

- **GIVEN** two consumers hold the same subject with steps A and B
- **WHEN** one consumer edits step A and another edits step B
- **THEN** both edits remain after the changes propagate
- **AND** neither edit replaces the other item

#### Scenario: Invariants are preserved by every mutation

- **WHEN** a business mutation is applied
- **THEN** `id`, `parentId`, `title`, `priority`, `done` and optional `note` stay coherent with the V1 hierarchy and content rules

#### Scenario: A single step change does not rewrite the whole document

- **WHEN** one step is created, edited, completed, reordered or removed
- **THEN** only the affected records are written
- **AND** no operation replaces every subject or step record

### Requirement: Multi-tab coherence without the storage event

A change committed in one tab SHALL be observable in other tabs of the same
origin through the Dexie change/live-query mechanism or a broadcast channel,
without relying solely on the browser `storage` event.

#### Scenario: A commit in one tab reaches another

- **GIVEN** two tabs of the same origin observe the same local store
- **WHEN** one tab commits a business mutation
- **THEN** the other tab observes a coherent updated state

#### Scenario: Propagation does not rely only on the storage event

- **WHEN** a change propagates between tabs
- **THEN** a Dexie change subscription or broadcast channel carries the notification
- **AND** the browser `storage` event is not the only propagation path

#### Scenario: Propagated state stays coherent

- **WHEN** two tabs have propagated several independent mutations
- **THEN** both projections match the committed record set without duplicated or divergent entities

### Requirement: Strictly local non-synchronized preferences

The tracked-action preference and other UI/local metadata that reference business identifiers SHALL be stored in an origin-scoped, per-workspace IndexedDB store that is never synchronized or exported. They MUST NOT be written to synchronized tables, MUST NOT appear in a business backup, and MUST survive failure and reload through an idempotent migration from legacy local storage.

#### Scenario: Preferences are not synchronized

- **WHEN** a preference is set
- **THEN** it is absent from every synchronized store
- **AND** the local metadata store is declared unsynchronized with Dexie Cloud
- **AND** no business title, note, email, OTP or token is stored in it

#### Scenario: Preferences are not exported

- **WHEN** the workspace is exported with the modern backup
- **THEN** the export contains no preference or local metadata field
- **AND** only business subject and item records are present

#### Scenario: Preferences are restored locally

- **WHEN** a preference was set and the page is reopened
- **THEN** the preference is restored from the local non-synchronized IndexedDB store without a network request
- **AND** a legacy local preference is migrated once and idempotently before its old key stops being read

#### Scenario: Legacy preference write failure is truthful

- **GIVEN** an old preference exists and the IndexedDB metadata write fails
- **WHEN** the application attempts the migration
- **THEN** the failure is reported as a local storage problem
- **AND** the old value is not deleted or overwritten
- **AND** the preference is not reported as durably stored

### Requirement: All current business operations over the store

Create/edit, completion, substep creation, promotion, ordering, removal and undo, filters, the pending counter, the suggestion, tracking, routes, modern backup import and modern backup export SHALL be served by the transactional store in every persistence mode, including when no Cloud configuration exists. `site/core.js` SHALL stay pure and the current UI rules and observable behavior SHALL stay unchanged.

#### Scenario: Each operation persists through the store

- **WHEN** any of create, edit, complete, add substep, promote, reorder, remove, restore, filter, count, suggest, track or route operations is performed without Cloud
- **THEN** it is applied through the local transactional store
- **AND** its result survives a reload

#### Scenario: Create, edit, delete and reload keep the same records

- **GIVEN** an empty autonomous local workspace
- **WHEN** a subject and steps are created, edited and deleted, then the application is reloaded
- **THEN** the reloaded view reflects the same committed records and relations
- **AND** no record was read from or written to the historical `localStorage` document

#### Scenario: Local JSON import is atomic

- **GIVEN** local records already exist
- **WHEN** a valid modern backup is imported and confirmed
- **THEN** only absent records are added and existing records are never silently overwritten
- **AND** a collision or an invalid file leaves every local record unchanged
- **AND** a V1 document is rejected without write

#### Scenario: Export reads committed IndexedDB records

- **GIVEN** local records were committed without Cloud
- **WHEN** the user exports a backup
- **THEN** the JSON is built directly from the committed local records in the modern versioned format
- **AND** the source is not the historical `localStorage` key
- **AND** no V1 envelope is produced

#### Scenario: The domain core stays pure

- **WHEN** the pure domain module is inspected
- **THEN** it performs no storage, network or DOM access

#### Scenario: Existing observable behavior is unchanged

- **WHEN** the existing business interactions are exercised
- **THEN** their rules, validations, ordering, hierarchy and visible content match the previous behavior
- **AND** only the backup/import storage contract changes

### Requirement: Versioned IndexedDB backup import and export

The application SHALL export and import a versioned IndexedDB backup that declares its format, canonical identifiers, counts and checksum and carries subject/item records directly. Import MUST validate the whole file before any plan, MUST reject V1 documents, and MUST apply only non-destructive, fingerprint-bound operations.

#### Scenario: Round-trip preserves every business field

- **GIVEN** a workspace with subjects, nested steps, notes, priorities, `done` flags and order
- **WHEN** it is exported with the modern format and imported into an empty test target
- **THEN** every subject, step, id, `parentId`, order, priority, `done` and note is preserved
- **AND** counts and checksum match the exported records

#### Scenario: Invalid or legacy file changes nothing

- **WHEN** an invalid, truncated, checksum-mismatched or `version: 1` file is imported
- **THEN** the import fails with an explicit message
- **AND** no local record is added, changed, removed or partially overwritten

### Requirement: Retired V1 business data remains inert

The historical `threadstep.document.v1` key MUST NOT be read as a business source by the current application. Its presence MUST NOT produce a migration offer, a compatibility guard, an export button, a business view or any synchronized write. It MUST remain physically untouched until an explicit cleanup.

#### Scenario: Legacy value is not a business fallback

- **GIVEN** a stored V1 document exists and the IndexedDB workspace is empty
- **WHEN** the local-only application starts
- **THEN** the business view is empty because IndexedDB is the only business source
- **AND** no automatic conversion, import or display of the V1 document occurs
- **AND** a modern backup of the empty workspace can still be produced

#### Scenario: Legacy value is never erased implicitly

- **WHEN** the local store is initialized, opened, modified, synchronized or disconnected
- **THEN** no historical V1 record is deleted, renamed, cleared or overwritten by the application
- **AND** no destructive migration runs
