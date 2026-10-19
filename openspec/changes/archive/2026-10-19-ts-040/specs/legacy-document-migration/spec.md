# Spec Delta

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Historical V1 document detection and strict validation
**Reason**: V1 detection is retired. Keeping strict detection would preserve a reader and a migration path that the product decision removes.

**Migration**: No V1 document is detected or migrated. Use the modern IndexedDB backup. A legacy value remains inert until voluntary cleanup.

### Requirement: Preservation of full historical content and hierarchy
**Reason**: There is no V1-to-IndexedDB migration preserving a historical document. Business records are already persisted as IndexedDB entities.

**Migration**: Modern backups preserve subjects, items, IDs, hierarchy, notes, priorities, order and `done` directly from IndexedDB.

### Requirement: Explicit consent before any synchronized import
**Reason**: The consent gate applied to V1 migration into synchronized tables. No V1 import path remains; Cloud transfer consent is still governed by `cloud-opt-in-activation`.

**Migration**: Modern backup imports use the existing plan-bound reconciliation and activation consent. V1 documents are refused before any plan.

### Requirement: Migration destination and effect disclosure
**Reason**: The destination disclosure described the retired V1 migration to a Cloud base.

**Migration**: Activation and reconciliation keep their own destination/plan disclosure requirements under `cloud-opt-in-activation` and `data-reconciliation`.

### Requirement: Atomic migration
**Reason**: The atomic V1 migration no longer exists.

**Migration**: Modern import/merge/restore remain atomic and fingerprint-bound under `data-backup-import-restore`.

### Requirement: Idempotent migration and collision handling
**Reason**: V1 migration idempotency and collision rules are replaced by modern record import idempotency.

**Migration**: Reimporting the same modern backup produces no operation; collisions block without overwrite under `data-backup-import-restore`.

### Requirement: Populated target base is not silently overwritten
**Reason**: The populated-target V1 migration flow is retired.

**Migration**: Modern merge inserts only absent records and never overwrites a different existing record; restore remains a separate reinforced intention.

### Requirement: Stable legacy identifier mapping
**Reason**: No V1 identifier mapping remains in the current runtime.

**Migration**: Modern backups declare canonical identifiers and preserve them exactly; no prefix is added or removed.

### Requirement: No implicit cross-base transfer on URL change
**Reason**: The V1 migration that could be bound to a URL no longer exists. URL/account isolation remains governed by `workspace-identity-isolation`.

**Migration**: No legacy value is copied between bases. Modern imports always require an explicit source and a plan for the current destination.

### Requirement: Non-destructive failure and source retention
**Reason**: The V1 migration lifecycle is retired, so its failure/source-retention semantics no longer apply.

**Migration**: The legacy key remains physically intact until voluntary cleanup. Modern backup import/restore failures leave the workspace unchanged under `data-backup-import-restore`.
