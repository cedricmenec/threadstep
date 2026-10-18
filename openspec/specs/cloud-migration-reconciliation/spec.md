# cloud-migration-reconciliation Specification

## Purpose

Defines how ThreadStep safely reconciles historical V1 or JSON data with an
already-authenticated Dexie Cloud database: attested initial sync, precise
business inventory, accessible consent, partial insert-only reconciliation,
controlled conflict copies, plan-bound atomic commit and truthful status.

## Requirements

### Requirement: Attested initial remote synchronization

Before planning any reconciliation, the application SHALL obtain a native Dexie
Cloud attestation that the authenticated user's remote database completed its
initial synchronization and is healthy. It MUST fail closed when the device is
offline, the session is refused or mismatched, the initial sync is pending, the
remote state is indeterminate or a read fails. An empty IndexedDB target MUST NOT
be treated as proof that Cloud is empty.

#### Scenario: A healthy attested database enables planning

- **GIVEN** an authenticated session whose persisted synchronization proves the initial sync of the configured remote database
- **WHEN** the native synchronization state reports a healthy in-sync phase
- **THEN** the application may read the target and build a reconciliation plan
- **AND** the target is read only after the attestation succeeds

#### Scenario: An empty local target with a pending initial sync is blocked

- **GIVEN** the target tables are empty in IndexedDB
- **AND** the initial remote synchronization is still pending
- **WHEN** a historical document is available
- **THEN** no reconciliation plan is offered
- **AND** no synchronized write occurs
- **AND** the application does not conclude that the Cloud database is empty

#### Scenario: Offline migration is blocked

- **WHEN** the device is offline or the native synchronization reports an offline state
- **THEN** planning and writes are blocked with an understandable diagnostic
- **AND** the historical source remains intact

#### Scenario: A refused or changed session is blocked

- **WHEN** no authenticated session is available, the session is refused, or the persisted remote identity does not match the current user
- **THEN** no reconciliation plan is offered and no write occurs
- **AND** the destination and source are unchanged

#### Scenario: An indeterminate or failed read is not an empty base

- **WHEN** the native synchronization signals are missing, contradictory or in error
- **OR** reading the target records fails
- **THEN** the application reports a diagnostic and blocks writes
- **AND** it never substitutes an empty target for the failed or unknown state

### Requirement: Store-aware business inventory

The application SHALL compare each mapped source record with the target per store
(`subjects`, `items`). It SHALL compare only business fields: subject id, title
and order; item id, subject, parent, title, note, priority, `done` and order.
Native Cloud metadata such as `owner`, `realmId` and `$ts` MUST be ignored. Each
record SHALL be classified as identical, absent in Cloud, business conflict,
Cloud-only or invalid/indeterminate.

#### Scenario: Native metadata does not create a conflict

- **GIVEN** a target record whose business fields equal the source record
- **AND** the target record also carries Cloud owner, realm or timestamp metadata
- **WHEN** the inventory is computed
- **THEN** the record is classified identical
- **AND** no operation targets it

#### Scenario: Real business changes are reported

- **WHEN** a mapped target record differs in title, note, priority, `done`, parent, subject or relative order
- **THEN** the record is classified as a conflict
- **AND** the differing field names are reported
- **AND** the change is not hidden as identical

#### Scenario: The two stores are not confused

- **GIVEN** the same identifier exists in the `subjects` store and in the `items` store
- **WHEN** the inventory compares a source item
- **THEN** only the `items` store is used for that comparison
- **AND** a subject record with that identifier is not treated as the same item

#### Scenario: Cloud-only records are reported and preserved

- **WHEN** a target record has no corresponding mapped source record
- **THEN** it is classified as Cloud-only
- **AND** it is not scheduled for update or removal

#### Scenario: Invalid or ambiguous source and target data block classification

- **WHEN** source records map to the same identifier within one store
- **OR** the target contains dangling, malformed or contradictory relations
- **THEN** the affected inventory is invalid or indeterminate
- **AND** no write is planned for it

### Requirement: Accessible reconciliation preview and explicit consent

Before any consent, the application SHALL present the effective destination, the
subject and item counts per inventory category, the conflicting records and the
differing field names. Business content MUST be rendered as non-executable text
and MUST NOT be written to public logs. The preview and conflict choices SHALL
be usable by touch and keyboard on mobile, and consent MUST be explicit and
distinct from the OTP sign-in.

#### Scenario: Disclosure shows categories and destination

- **WHEN** a reconciliation plan is ready
- **THEN** the preview identifies the effective Cloud destination
- **AND** it shows subject and item counts for each inventory category
- **AND** it lists conflicting records and differing field names
- **AND** consent is requested only after this disclosure

#### Scenario: Business content is not executable or logged

- **WHEN** titles or notes containing markup-like text are displayed
- **THEN** they appear as literal text and are not interpreted as HTML
- **AND** no public log contains record content, titles, notes or field values

#### Scenario: Authentication alone is not migration consent

- **GIVEN** the user has just signed in with an OTP
- **WHEN** no reconciliation plan has been explicitly confirmed
- **THEN** no historical or JSON record is written to the target
- **AND** the confirmation is a separate action from authentication

#### Scenario: Controls remain operable on mobile and keyboard

- **WHEN** the preview is displayed on a mobile viewport
- **THEN** conflict choices and actions have accessible names and labels
- **AND** they can be reached and activated by keyboard without a pointer
- **AND** touch targets are large enough for reliable touch use

### Requirement: Partial non-overwriting reconciliation

A populated target MUST NOT block reconciliation globally. After explicit
confirmation, the application SHALL insert only records that are genuinely
absent and independent, and MUST NOT rewrite identical or Cloud-only records.
Relations and business quotas MUST be preserved. A branch that depends on an
unresolved conflict SHALL remain blocked with an explanation, while independent
branches may proceed.

#### Scenario: A 5-subject / 18-step source reconciles into a populated target

- **GIVEN** a valid V1 source containing 5 subjects and 18 steps
- **AND** a target already containing some Cloud-only and some historical records
- **WHEN** the confirmed independent plan is applied
- **THEN** only genuinely absent independent subjects and steps are inserted
- **AND** existing target records keep their content

#### Scenario: A conflict blocks only its dependent branch

- **GIVEN** a subject branch contains an unresolved conflicting step
- **AND** another subject branch is fully absent and conflict-free
- **WHEN** the plan is built
- **THEN** the conflicting step and its descendants are blocked with a reason
- **AND** the independent subject branch remains eligible for insertion

#### Scenario: Identical and Cloud-only records are not rewritten

- **WHEN** the plan contains identical or Cloud-only records
- **THEN** no operation updates or deletes them
- **AND** the target projection keeps their existing content

#### Scenario: Relations survive partial insertion

- **WHEN** absent steps are inserted
- **THEN** every `subjectId` and `parentId` points to the intended target subject or parent
- **AND** no step is attached to the wrong subject or parent

#### Scenario: Business quotas block only the overflowing branch

- **WHEN** inserting a branch would exceed 40 subjects or 500 steps in a subject
- **THEN** that branch is blocked with a quota explanation
- **AND** independent branches within quota remain eligible
- **AND** the target is not modified for the blocked branch

### Requirement: Keep-Cloud or deterministic-copy conflict resolution

For each divergence, the application SHALL offer at least « conserver la version
Cloud » and « importer la version historique comme copie ». It MUST NOT perform
a destructive `put` or overwrite. Copies SHALL receive new deterministic ids for
the same source and destination, be checked for availability, remap descendants
and parents coherently and never create a second copy on rerun. Keeping Cloud
MUST NOT delete the V1 source, and no destructive choice may be a default.

#### Scenario: Keeping Cloud preserves both sides

- **GIVEN** a subject conflict and a sub-step conflict
- **WHEN** the user explicitly chooses to keep the Cloud version for them
- **THEN** the target records are unchanged
- **AND** the V1 source and its JSON export remain available
- **AND** no copy is created for those conflicts

#### Scenario: Importing a copy preserves the hierarchy

- **GIVEN** a conflicting subject or sub-step
- **WHEN** the user explicitly chooses to import the historical version as a copy
- **THEN** the copy receives a new identifier
- **AND** its descendants and parent references use the copied identifiers coherently
- **AND** the original Cloud record remains intact
- **AND** the historical source remains available

#### Scenario: Copy identity is deterministic and available

- **WHEN** the same source and destination produce the same conflict copy more than once
- **THEN** the derived copy identifier is identical
- **AND** the identifier is checked against the target before planning
- **AND** an unavailable identifier with different content blocks only that copy branch

#### Scenario: A second run does not duplicate copies

- **GIVEN** a conflict copy was fully committed
- **WHEN** the same reconciliation is run again or the page is reloaded
- **THEN** the existing copy is recognized as already applied
- **AND** no second copy is created
- **AND** the plan does not rewrite the copy

#### Scenario: Unresolved conflicts have no destructive default

- **WHEN** the user does not choose a resolution for a conflict
- **THEN** the affected branch is excluded and explained
- **AND** no overwrite, deletion or copy is performed for it
- **AND** independent confirmed groups may still be imported

### Requirement: Plan-bound consent and pre-commit revalidation

Every plan SHALL be bound to a fingerprint of the source, the Cloud URL, the
remote database, the session/user and a target projection including resolutions.
Immediately before commit, the source, destination, user, target, conflicts and
synchronization availability MUST be revalidated. Any change SHALL invalidate
consent and require a new review, and the migration layer, not only the UI, MUST
reject a stale or unconsented plan.

#### Scenario: A changed source invalidates consent

- **WHEN** the V1 document or selected JSON source changes after the preview
- **THEN** the commit is refused as stale
- **AND** no target record is written
- **AND** a new review is required

#### Scenario: A changed destination or session invalidates consent

- **WHEN** the Cloud URL, remote database or authenticated user changes after the preview
- **THEN** the commit is refused as stale
- **AND** no data is routed to the new destination
- **AND** both sources and bases remain unchanged

#### Scenario: A changed target or conflict invalidates consent

- **WHEN** a target record changes, appears or disappears after the preview
- **OR** a new conflict appears
- **THEN** the commit is refused as stale
- **AND** the target is not overwritten
- **AND** a new review is required

#### Scenario: Lost synchronization availability blocks the commit

- **WHEN** the device goes offline or the native synchronization leaves a healthy state before commit
- **THEN** the commit is refused
- **AND** no record is written
- **AND** the diagnostic does not claim a Cloud success

#### Scenario: Missing, mismatched or non-explicit consent is refused

- **WHEN** consent is absent, false, or bound to a different plan fingerprint
- **THEN** the migration layer refuses the commit
- **AND** the adapter is not called
- **AND** the source and target remain unchanged

#### Scenario: An unchanged plan commits once

- **GIVEN** the source, destination, user, target, resolutions and synchronization attestation are unchanged
- **WHEN** the matching explicit consent is submitted
- **THEN** the migration layer calls the adapter once with the planned insertions

### Requirement: Atomic add-only commit and idempotent recovery

A confirmed reconciliation SHALL commit in one atomic IndexedDB transaction using
`add` insertions and anti-overwrite checks, with no `put`, `delete` or partial
group. A collision after revalidation, a transaction failure or an interruption
MUST NOT overwrite, leave a half group or report false success. Reruns, retries
and reloads SHALL remain idempotent.

#### Scenario: A late collision rolls back without overwriting

- **GIVEN** a record with a planned identifier appears in the target after revalidation
- **WHEN** the transaction tries to insert the planned record
- **THEN** the insertion is refused
- **AND** the transaction leaves the target unchanged
- **AND** no success is reported

#### Scenario: A transaction failure leaves no partial group

- **WHEN** the IndexedDB transaction fails midway
- **THEN** no inserted record from that attempt remains
- **AND** the target keeps its previous state
- **AND** the source remains intact
- **AND** an error state is reported

#### Scenario: Concurrent plans cannot overwrite each other

- **GIVEN** two reconciliation attempts plan overlapping identifiers
- **WHEN** they commit concurrently
- **THEN** the first valid insertion wins
- **AND** the other is refused without overwriting the first
- **AND** the failure is reported truthfully

#### Scenario: A completed commit is idempotent after reload

- **GIVEN** a reconciliation was fully committed
- **WHEN** the page reloads and the same source is reconciled again
- **THEN** all inserted records and copies are recognized
- **AND** no duplicate is created
- **AND** no record is rewritten

### Requirement: Truthful status and source recovery

The application SHALL distinguish written locally, synchronization pending,
synchronized and error using only available evidence. A local IndexedDB commit
MUST NOT be announced as a remote push. `threadstep.document.v1` and historical
JSON exports MUST remain intact and recoverable before and after any attempt. No
purge, implicit deletion or cross-URL copy SHALL occur.

#### Scenario: A local commit is not a synchronization

- **WHEN** the reconciliation transaction commits locally
- **THEN** the application reports that records were written locally
- **AND** it reports synchronization as pending or unknown
- **AND** it does not claim the data is synchronized or pushed

#### Scenario: Only native proof reports synchronization

- **WHEN** a native sync-complete event arrives after the local commit and the native state is healthy
- **THEN** the application may report the records as synchronized
- **AND** an earlier local-only state is not retroactively invented

#### Scenario: A later synchronization error preserves local success

- **WHEN** the local commit succeeded and a later synchronization fails
- **THEN** the local write remains reported as written locally
- **AND** the synchronization state is reported as an error
- **AND** the error is distinct from a failed local transaction

#### Scenario: Cancellation, refusal or error keeps recovery possible

- **WHEN** the user cancels or refuses, or an error or interruption occurs
- **THEN** the V1 key and its JSON export remain readable
- **AND** no Cloud-only record is removed
- **AND** no implicit purge or deletion is performed

#### Scenario: A URL change copies nothing

- **WHEN** the configured Dexie Cloud URL changes
- **THEN** no historical or target record is copied into the new base automatically
- **AND** the previous base and source remain intact

### Requirement: JSON import uses the same reconciliation

A JSON V1 backup chosen through the Cloud interface SHALL use the same
attestation, inventory, accessible preview, conflict resolution, consent,
revalidation and atomic commit as the historical source. The local-only JSON
import path MUST keep its current confirmation and replacement behavior and MUST
NOT be changed by Cloud reconciliation.

#### Scenario: A JSON backup reconciles into a populated Cloud base

- **GIVEN** an authenticated, attested Cloud base already containing records
- **WHEN** the user selects a valid V1 JSON backup in the Cloud interface
- **THEN** the application shows the same inventory and conflict choices
- **AND** it does not block globally merely because the target is populated
- **AND** only the explicitly confirmed independent groups are inserted

#### Scenario: An invalid JSON import writes nothing

- **WHEN** the selected JSON file fails V1 validation
- **THEN** no plan is applied
- **AND** the target, the file and the V1 source remain unchanged
- **AND** an understandable message is shown

#### Scenario: The local-only import remains unchanged

- **GIVEN** no Cloud database is configured
- **WHEN** the user imports a valid JSON document
- **THEN** the existing local confirmation and replacement behavior applies
- **AND** no Cloud attestation, consent or migration is required

### Requirement: Deterministic, side-effect-free reconciliation

Given identical source, destination, user, target and resolutions, the inventory,
fingerprints, copy identifiers, insertion operations and preview model SHALL be
identical across runs. Planning MUST NOT write, call the network or touch the DOM,
and this determinism SHALL be verifiable by automated tests.

#### Scenario: Repeated planning produces the same result

- **WHEN** the same inputs are planned more than once
- **THEN** the classifications, fingerprints, copy identifiers and operations are identical
- **AND** no source or target record is written by planning

#### Scenario: Metadata differences do not change the plan

- **WHEN** only native Cloud metadata differs between two target reads
- **THEN** the business inventory and planned operations remain identical

### Requirement: Canonical identity mapping for Cloud imports

Le parcours Cloud (migration historique et import JSON) SHALL résoudre les identifiants avec le même résolveur de provenance que la conversion locale et l'interface. Il MUST conserver les identifiants déjà canoniques, ne jamais produire `legacy:legacy:` pour une source déjà projetée, et MUST bloquer sans écriture une provenance ambiguë. Les relations `subjectId` et `parentId` SHALL suivre la même transformation.

#### Scenario: Cloud import of a projected export

- **GIVEN** un export IndexedDB déclaré canonique contenant `legacy:s1` et une tâche `subjectId: legacy:s1`
- **WHEN** l'utilisateur choisit ce fichier dans l'interface Cloud
- **THEN** le plan utilise le même appel de mapping que l'interface et la conversion locale
- **AND** aucun identifiant ne devient `legacy:legacy:s1`
- **AND** le `subjectId` et le `parentId` restent cohérents

#### Scenario: Second Cloud import creates no duplicate

- **GIVEN** un premier import Cloud confirmé et commité
- **WHEN** le même fichier est importé une seconde fois
- **THEN** les enregistrements identiques sont reconnus
- **AND** aucune insertion ni copie n'est créée
- **AND** les relations existantes restent inchangées

#### Scenario: Raw V1 source is mapped once

- **GIVEN** un document V1 déclaré brut avec des identifiants non préfixés
- **WHEN** il est importé dans une base Cloud attestée
- **THEN** chaque identifiant reçoit une seule fois le préfixe canonique
- **AND** les relations suivent le même mapping

#### Scenario: Ambiguous provenance blocks the Cloud plan

- **GIVEN** un fichier non marqué contenant des identifiants `legacy:`
- **AND** la provenance réelle ne peut pas être prouvée
- **WHEN** l'utilisateur tente de l'importer dans le Cloud
- **THEN** aucun plan d'écriture n'est proposé
- **AND** l'interface demande une décision de provenance avec les deux interprétations
- **AND** aucune donnée n'est écrite avant cette décision

#### Scenario: Unmarked plain identifiers are not assumed raw

- **GIVEN** un fichier non marqué dont les identifiants ne portent aucun préfixe
- **WHEN** il pourrait être un V1 brut ou un ancien export IndexedDB à identifiants générés
- **THEN** l'import Cloud demande explicitement la provenance
- **AND** aucun mapping n'est appliqué avant la réponse
- **AND** une provenance brute confirmée applique le mapping canonique une seule fois

#### Scenario: Historical double-prefixed export is not guessed

- **GIVEN** une source `legacy:legacy:s1` sans provenance explicite
- **WHEN** elle est présentée à l'import Cloud
- **THEN** elle reste ambiguë
- **AND** le moteur ne retire pas un préfixe pour deviner son identité
- **AND** aucun plan n'est appliqué sans provenance confirmée
