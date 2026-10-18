# Spec Delta

## MODIFIED Requirements

### Requirement: Transactional local-first business writes
Every business mutation SHALL be applied through a Dexie/IndexedDB transaction, and a write SHALL be considered recorded locally as soon as that transaction commits, without waiting for a Dexie Cloud acknowledgement. The interface SHALL distinguish local recording from remote synchronization and MUST NOT imply a pending remote synchronization when Cloud is not activated.

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

### Requirement: All current business operations over the store
Create/edit, completion, substep creation, promotion, ordering, removal and undo, filters, the pending counter, the suggestion, tracking, routes, JSON import and JSON export SHALL be served by the transactional store in every persistence mode, including when no Cloud configuration exists. `site/core.js` SHALL stay pure and the current UI rules and observable behavior SHALL stay unchanged.

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
- **WHEN** a valid V1 document is imported and confirmed
- **THEN** the local records are replaced by one committed operation set
- **AND** an invalid import leaves every local record unchanged

#### Scenario: Export reads committed IndexedDB records
- **GIVEN** local records were committed without Cloud
- **WHEN** the user exports a backup
- **THEN** the JSON is built from the committed local records in the V1 shape
- **AND** the source is not the historical `localStorage` key

#### Scenario: The domain core stays pure
- **WHEN** the pure domain module is inspected
- **THEN** it performs no storage, network or DOM access

#### Scenario: Existing observable behavior is unchanged
- **WHEN** the existing business interactions are exercised
- **THEN** their rules, validations, ordering, hierarchy and export shape match the previous behavior

### Requirement: Non-destructive compatibility guard for V1 data
Until the explicit local conversion (TS-033) and the explicit Cloud transfer consent (TS-037), the change MUST NOT make existing V1 data invisible or erase it, and MUST NOT transfer it to Dexie Cloud without explicit consent. The historical `threadstep.document.v1` key MUST NOT be purged, renamed, overwritten or hidden; a non-destructive compatibility guard SHALL keep the historical document readable and exportable.

#### Scenario: Historical V1 data stays visible
- **GIVEN** a stored V1 document exists
- **WHEN** the local-only application starts
- **THEN** the historical subjects and steps remain readable through the compatibility guard
- **AND** a byte-for-byte V1 export remains available
- **AND** the new local workspace does not hide the historical key

#### Scenario: Historical data is never erased
- **WHEN** the local store is initialized, opened or modified
- **THEN** no historical V1 record is deleted
- **AND** the historical key is not renamed, cleared or overwritten
- **AND** no destructive migration runs

#### Scenario: No automatic conversion
- **GIVEN** a valid historical V1 document exists
- **WHEN** the local workspace starts empty
- **THEN** no automatic conversion into IndexedDB is performed
- **AND** the user is informed that the historical document remains preserved and exportable
- **AND** conversion is a separate explicit operation

#### Scenario: No consent-less transfer
- **WHEN** historical local data exists and no explicit Cloud consent was given
- **THEN** it is not sent to Dexie Cloud
- **AND** no synchronized workspace is configured on its behalf
