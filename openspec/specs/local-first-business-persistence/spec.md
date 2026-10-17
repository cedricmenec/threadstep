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
distinguish local recording from remote synchronization.

#### Scenario: An offline write is confirmed on commit

- **GIVEN** the local store was initialized and a session allows local access
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

### Requirement: Atomic JSON V1 import and export compatibility

A JSON V1 import SHALL validate the complete document and apply it atomically; a
rejected import MUST leave local records unchanged. Export SHALL remain
V1-compatible and an export/import round-trip SHALL preserve subjects, steps,
ids, `parentId`, order, `priority`, `done` and `note`.

#### Scenario: A valid import replaces records atomically

- **WHEN** a valid V1 document is imported
- **THEN** the local records are replaced by the imported document in one operation set
- **AND** a subsequent export reproduces the imported content

#### Scenario: An invalid import changes nothing

- **WHEN** an imported document is invalid
- **THEN** the import fails with a message
- **AND** no local record is added, changed, removed or partially overwritten

#### Scenario: A round-trip preserves content and hierarchy

- **WHEN** a document is exported and re-imported
- **THEN** every subject, step, id, `parentId`, order, `priority`, `done` and `note` is preserved

### Requirement: Strictly local non-synchronized preferences

The tracked-action preference and other UI-only preferences SHALL remain in
origin-scoped local non-synchronized storage. They MUST NOT be written to
synchronized tables and MUST NOT appear in the JSON export.

#### Scenario: Preferences are not synchronized

- **WHEN** a preference is set
- **THEN** it is absent from every synchronized store

#### Scenario: Preferences are not exported

- **WHEN** the document is exported
- **THEN** the export contains no preference field

#### Scenario: Preferences are restored locally

- **WHEN** a preference was set and the page is reopened
- **THEN** the preference is restored from local non-synchronized storage without a network request

### Requirement: All current business operations over the store

Create/edit, completion, substep creation, promotion, ordering, removal and
undo, filters, the pending counter, the suggestion, tracking and routes SHALL be
served by the transactional store, while `site/core.js` stays pure and the
current UI rules and observable behavior stay unchanged.

#### Scenario: Each operation persists through the store

- **WHEN** any of create, edit, complete, add substep, promote, reorder, remove, restore, import, filter, count, suggest, track or route operations is performed
- **THEN** it is applied through the transactional store
- **AND** its result survives a reload

#### Scenario: The domain core stays pure

- **WHEN** the pure domain module is inspected
- **THEN** it performs no storage, network or DOM access

#### Scenario: Existing observable behavior is unchanged

- **WHEN** the existing business interactions are exercised
- **THEN** their rules, validations, ordering, hierarchy and export shape match the previous behavior

### Requirement: Non-destructive compatibility guard for V1 data

Until the localStorage V1 conversion (TS-026) and the OTP journey (TS-027) are
delivered, the change MUST NOT make existing V1 data invisible or erase it, and
MUST NOT transfer it to Dexie Cloud without explicit consent; a non-destructive
compatibility guard SHALL keep the historical document available.

#### Scenario: Historical V1 data stays visible

- **GIVEN** a stored or imported V1 document exists
- **WHEN** the transitional change is active
- **THEN** the historical subjects and steps remain readable and usable
- **AND** they are not hidden by the new store

#### Scenario: Historical data is never erased

- **WHEN** the new store is initialized or opened
- **THEN** no historical V1 record is deleted
- **AND** no destructive migration runs

#### Scenario: No consent-less transfer

- **WHEN** historical local data exists and no explicit consent was given
- **THEN** it is not sent to Dexie Cloud
- **AND** the compatibility guard prevents an intermediate state that would expose it
