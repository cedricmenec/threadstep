# data-integrity-recovery Specification

## Purpose

Diagnoses an inconsistent ThreadStep workspace without writing, keeps valid
records readable when the strict business projection fails, and exports a
faithful raw recovery file distinct from the V1 business export.

## Requirements

### Requirement: Read-only integrity inventory

The application SHALL inspect the `subjects` and `items` stores in a read-only
transaction and report counts and stable codes for missing references, prefix
variants, logical duplicates, identity collisions, parent inconsistencies,
content conflicts and visibility limitations. It MUST NOT create, rename,
delete or repair a record while inventorying or presenting the result. A
reference that is absent locally MUST NOT be reported as a deleted subject when
access rights could hide it.

#### Scenario: Five valid subjects and one orphan task are inventoried

- **GIVEN** a workspace containing 5 subjects and 19 tasks, where one task references a subject that is not present
- **WHEN** the read-only inventory is built
- **THEN** it reports 5 subjects and 19 tasks
- **AND** it reports one `dangling-subject` anomaly for the orphan task
- **AND** no record is written, renamed or deleted

#### Scenario: Prefix variants are reported without choosing a canonical one

- **GIVEN** the workspace contains `legacy:s1` and `legacy:legacy:s1` as candidate identities for the same subject
- **WHEN** the inventory is built
- **THEN** the variant is reported with a `prefix-variant` code and counts
- **AND** neither variant is automatically renamed, merged or declared canonical

#### Scenario: An invisible reference is not a deletion

- **GIVEN** a task reference cannot be resolved in the local store
- **AND** the native session or permission context may hide the target record or realm
- **WHEN** the inventory is built
- **THEN** the reference is reported as `invisible-or-unauthorized`
- **AND** it is not reported as a deleted subject
- **AND** no placeholder subject is created

#### Scenario: Inventory is side-effect free

- **WHEN** the same raw store contents are inventoried more than once
- **THEN** the counts, codes and candidate groups are identical
- **AND** the source and target records are unchanged

### Requirement: Distinct read failure categories

The application SHALL distinguish IndexedDB unavailable, IndexedDB read refused,
business projection invalid and record not visible or unauthorized. It SHALL
also expose an `indeterminate` fallback for missing or contradictory signals. No
category may be rendered as an empty workspace, an empty remote base or a
confirmed synchronization.

#### Scenario: IndexedDB is unavailable

- **WHEN** the local database cannot be opened or IndexedDB is unavailable
- **THEN** the application reports `storage-unavailable`
- **AND** it does not display an empty workspace or an empty Cloud conclusion
- **AND** it keeps any historical V1 backup readable and exportable

#### Scenario: IndexedDB read is refused

- **WHEN** the read transaction or table read is rejected
- **THEN** the application reports `read-refused`
- **AND** it does not claim that a complete export can be produced
- **AND** it does not infer that the workspace or the remote base is empty

#### Scenario: Business projection is invalid

- **GIVEN** the tables were read successfully
- **AND** the strict V1 business projection rejects a dangling or malformed record
- **WHEN** the read result is classified
- **THEN** the application reports `projection-invalid`
- **AND** it enters the read-only degraded consultation instead of hiding every record

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

### Requirement: Read-only degraded consultation

When the strict business projection fails, the application SHALL present a
read-only consultation view containing the subjects and tasks that remain
coherent, plus a list of every anomaly by code. It MUST NOT silently ignore an
anomalous record, enable business editing or perform an automatic repair. The
normal editing view MAY remain blocked until the user chooses a recovery action.

#### Scenario: Valid subjects remain consultable

- **GIVEN** a workspace of 5 subjects and 19 tasks fails strict projection because one task is orphaned
- **WHEN** the degraded consultation is displayed
- **THEN** the 5 coherent subjects remain readable
- **AND** the orphan task and its code are listed
- **AND** no record is written

#### Scenario: Anomalies are not silently dropped

- **WHEN** a record cannot be placed in the coherent view
- **THEN** it appears in the anomaly list with its store, identifier and code
- **AND** the counts of displayed and anomalous records account for every accessible record

#### Scenario: Editing is disabled while degraded

- **WHEN** the user attempts a business edit in degraded mode
- **THEN** no local or remote write occurs
- **AND** the application explains that recovery or repair is required first
- **AND** the stored records remain unchanged

### Requirement: Raw recovery export

The application SHALL offer a raw recovery export built from the accessible raw
`subjects` and `items` records, including records that cannot be projected,
orphans and the metadata needed for recovery. The export MUST be clearly
distinct from the V1 business export, MUST exclude tokens, OTPs, credentials and
secrets, and MUST NOT be reconstructed from an in-memory `lastRecords` snapshot
after a failed read.

#### Scenario: Raw export includes the orphan task

- **GIVEN** the workspace contains 5 subjects and 19 tasks, including one orphan
- **WHEN** the user requests a raw recovery export
- **THEN** the export contains all 19 accessible task records and the 5 subject records
- **AND** the orphan is included without silent omission
- **AND** the file declares that it is a raw recovery export, not a V1 business export

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
