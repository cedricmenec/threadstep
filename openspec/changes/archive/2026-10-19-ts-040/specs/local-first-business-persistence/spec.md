# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Atomic JSON V1 import and export compatibility
**Reason**: The product retires the V1 document and V1 backup format after securing a distinct IndexedDB backup. Keeping atomic V1 import/export would preserve the unsupported compatibility the task removes.

**Migration**: Use the modern versioned IndexedDB backup and its non-destructive merge/restore. V1 documents are refused explicitly without write.

### Requirement: Non-destructive compatibility guard for V1 data
**Reason**: The compatibility guard kept a V1 reader and business source alive. The decision is to make the legacy key inert and remove all V1 readers, not to maintain a permanent compatibility path.

**Migration**: The legacy key remains physically present until a voluntary, consented and scoped cleanup. No automatic purge is introduced; a verified modern backup is required before cleanup.
