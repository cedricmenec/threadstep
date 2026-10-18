# data-reconciliation Specification

## Purpose
Comparer deux jeux de données métier cohérents et produire un plan de rapprochement sûr, explicite, vérifiable, idempotent, lié à la source, à la destination et au consentement affiché.
## Requirements
### Requirement: Typed identity and business inventory
Le moteur SHALL comparer les enregistrements par namespace, store et identité durable. Il MUST ignorer les métadonnées techniques Dexie Cloud dans l'égalité métier et SHALL classer chaque enregistrement en identique, absent, divergent, propre à la cible ou invalide.
#### Scenario: Same ID in different stores
- **GIVEN** un même identifiant textuel dans deux stores distincts
- **WHEN** l'inventaire est construit
- **THEN** ces enregistrements ne sont jamais confondus
#### Scenario: Native metadata differs
- **WHEN** seuls `owner`, `realmId` ou des timestamps techniques diffèrent
- **THEN** les valeurs métier identiques ne produisent pas de faux conflit
#### Scenario: Target-only business record
- **WHEN** la cible possède un enregistrement absent de la source
- **THEN** cet enregistrement est inventorié comme spécifique à la cible
- **AND** il n'est pas supprimé ou réécrit implicitement
#### Scenario: Dangling relation or incompatible format
- **WHEN** un enregistrement présente un ID incohérent, un parent absent ou une structure invalide
- **THEN** il est signalé comme invalide ou indéterminé
- **AND** aucune écriture dépendante n'est proposée automatiquement
### Requirement: Non-destructive merge planning
Le plan SHALL distinguer groupes indépendants insérables, éléments déjà présents et branches dépendantes d'un conflit. Les insertions sûres SHALL être proposées sans écraser les autres, en préservant les relations et les contraintes métier fournies par le projet.
#### Scenario: Populated target with safe independent group
- **GIVEN** une cible contenant des données propres et une source contenant un groupe inédit
- **WHEN** la comparaison est fiable
- **THEN** seul ce groupe absent est proposé à l'insertion
- **AND** aucun record cible existant n'est réécrit
#### Scenario: Parent conflict blocks descendants
- **GIVEN** un parent divergent et ses descendants
- **WHEN** aucune résolution n'est choisie pour ce parent
- **THEN** les descendants dépendants restent exclus et expliqués
- **AND** les autres groupes indépendants peuvent rester insérables
### Requirement: Conflict choices without silent overwrite
Pour chaque conflit, l'application SHALL exposer au minimum « conserver la cible » et « importer une copie de la source » lorsqu'une copie est sémantiquement possible. Une stratégie supplémentaire de remplacement MUST nécessiter une politique distincte et un consentement renforcé.
#### Scenario: Keep target
- **WHEN** l'utilisateur choisit de conserver la cible
- **THEN** l'enregistrement distant existant est inchangé
- **AND** la source récupérable demeure intacte
#### Scenario: Import source as copy
- **WHEN** une branche divergente est copiée
- **THEN** elle reçoit une identité de copie déterministe pour cette source et cette destination
- **AND** les références parents/enfants sont remappées
- **AND** l'enregistrement original est préservé
#### Scenario: Repeat deterministic copy
- **GIVEN** une copie déjà importée et reconnue avec même provenance et version logique
- **WHEN** le même plan est reproduit
- **THEN** aucun doublon de copie n'est créé
- **AND** une collision avec un contenu différent bloque le groupe
### Requirement: Consent bound to the displayed plan
Le consentement SHALL être lié au plan **effectivement présenté**, à son empreinte source/cible, à l'identité, au périmètre, aux résolutions et à la destination. Toute divergence entre ce plan et une revalidation MUST demander une nouvelle revue.
#### Scenario: Target changed after preview
- **WHEN** un autre client modifie la cible pendant l'affichage du plan
- **THEN** la confirmation précédente est refusée
- **AND** un nouveau plan est affiché, à accepter séparément
#### Scenario: Source changed after preview
- **WHEN** l'utilisateur modifie le document local après la prévisualisation
- **THEN** le plan devient périmé
- **AND** aucune mutation n'est exécutée sur l'ancien consentement
#### Scenario: Replanning is not automatic consent
- **WHEN** le moteur recalcule un nouveau plan pendant le clic de confirmation
- **THEN** il compare son empreinte à celle que l'utilisateur avait réellement vue
- **AND** toute différence nécessite un nouveau geste explicite avant commit
#### Scenario: Destination or identity switched
- **WHEN** l'URL Cloud, le remoteDbId, l'utilisateur ou ses droits changent
- **THEN** le plan est invalidé
- **AND** aucune donnée n'est transférée à cette nouvelle identité
### Requirement: Local atomicity and truthful remote status
Le commit SHALL employer des transactions IndexedDB atomiques et des insertions anti-écrasement. La réussite locale MUST NOT être confondue avec la convergence distante ou une transaction distribuée garantie.
#### Scenario: Late collision
- **WHEN** un ID planifié existe déjà au moment de l'insertion
- **THEN** l'opération refuse l'écrasement
- **AND** les insertions de la même transaction sont annulées
#### Scenario: Remote conflict after local commit
- **WHEN** Dexie Cloud refuse ou transforme ensuite une mutation localement validée
- **THEN** l'état signale le conflit ou l'échec de réplication
- **AND** il n'affirme pas que l'opération est atomique entre tous les appareils
#### Scenario: Cancellation
- **WHEN** l'utilisateur annule sans valider
- **THEN** aucune écriture de rapprochement n'est effectuée
- **AND** sources, cibles et sauvegardes restent intactes
## Notes d'intégration
Le profil définit les champs métier et règles de conflit (ordre relatif, quotas, parents, delete/tombstone). La comparaison de snapshots ne garantit pas seule l'absence de concurrence distante ; exiger un test E2E et une stratégie d'échec fermé quand la preuve est insuffisante.
