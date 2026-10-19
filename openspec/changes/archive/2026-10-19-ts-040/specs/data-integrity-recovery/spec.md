# Spec Delta

## MODIFIED Requirements

### Requirement: Distinct read failure categories
The application SHALL distinguish IndexedDB unavailable, IndexedDB read refused, business projection invalid and record not visible or unauthorized. It SHALL also expose an `indeterminate` fallback for missing or contradictory signals. No category may be rendered as an empty workspace, an empty remote base or a confirmed synchronization, and no category may fall back to reading a retired V1 document as business data.

#### Scenario: IndexedDB is unavailable
- **WHEN** the local database cannot be opened or IndexedDB is unavailable
- **THEN** the application reports `storage-unavailable`
- **AND** it does not display an empty workspace or an empty Cloud conclusion
- **AND** it does not read or export the retired `threadstep.document.v1` as business data
- **AND** it keeps any already-produced modern backup untouched

#### Scenario: IndexedDB read is refused
- **WHEN** the read transaction or table read is rejected
- **THEN** the application reports `read-refused`
- **AND** it does not claim that a complete export can be produced
- **AND** it does not infer that the workspace or the remote base is empty
- **AND** it does not offer a V1 export or restoration

#### Scenario: Business projection is invalid
- **GIVEN** the tables were read successfully
- **AND** the strict projection rejects a dangling or malformed record
- **WHEN** the read result is classified
- **THEN** the application reports `projection-invalid`
- **AND** it enters the read-only degraded consultation instead of hiding every record
- **AND** the normal modern business backup remains disabled or explicitly incomplete

#### Scenario: A record is not visible or not authorized
- **WHEN** the local data or a reference may be hidden by a permission, realm or owner restriction
- **THEN** the application reports `not-visible-unauthorized`
- **AND** it does not report the record as deleted
- **AND** it does not report synchronization as confirmed

#### Scenario: Signals are missing or contradictory
- **WHEN** the available native or storage signals cannot support one of the other categories
- **THEN** the application reports `indeterminate`
- **AND** it does not conclude that the workspace or the remote base is empty
- **AND** no write is attempted

### Requirement: Raw recovery export
The application SHALL offer a raw recovery export built from the accessible raw `subjects` and `items` records, including records that cannot be projected, orphans and the metadata needed for recovery. The export MUST be clearly distinct from the modern IndexedDB business backup, MUST exclude tokens, OTPs, credentials and secrets, and MUST NOT be reconstructed from an in-memory `lastRecords` snapshot after a failed read.

#### Scenario: Raw export includes the orphan task
- **GIVEN** the workspace contains 5 subjects and 19 tasks, including one orphan
- **WHEN** the user requests a raw recovery export
- **THEN** the export contains all 19 accessible task records and the 5 subject records
- **AND** the orphan is included without silent omission
- **AND** the file declares that it is a raw recovery export, not a modern business backup and not a V1 document

#### Scenario: Recovery export is read from the stores
- **GIVEN** the strict projection failed but the raw tables were read successfully
- **WHEN** the raw recovery export is produced
- **THEN** it is built from the raw store records
- **AND** it is not built from a previous in-memory business snapshot
- **AND** its declared counts match the exported records

#### Scenario: No complete export when the read is refused
- **WHEN** the raw stores cannot be read
- **THEN** no raw recovery export is offered or produced
- **AND** the application explains that a complete recovery export is impossible
- **AND** it does not present a partial or in-memory snapshot as complete

#### Scenario: Export contains no secret
- **WHEN** a raw recovery export is generated for an authenticated session
- **THEN** it contains no token, OTP, credential or secret
- **AND** it contains only the accessible records and recovery-relevant metadata

#### Scenario: Raw recovery is not a V1 compatibility path
- **GIVEN** an export brut de récupération existant
- **WHEN** l'utilisateur tente de l'utiliser comme sauvegarde métier ou document V1
- **THEN** il n'est pas assimilé à un import de sauvegarde modern
- **AND** aucune conversion V1 implicite n'est tentée
- **AND** le format et l'intention de récupération restent explicitement distincts
