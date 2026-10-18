# Spec Delta

## MODIFIED Requirements

### Requirement: Typed identity and business inventory

Le moteur SHALL comparer les enregistrements par namespace, store et identité durable. Il MUST ignorer les métadonnées techniques Dexie Cloud dans l'égalité métier et SHALL classer chaque enregistrement en identique, absent, divergent, propre à la cible ou invalide. Une variante de préfixe ou une référence potentiellement invisible SHALL être classée comme ambiguë ou indéterminée, jamais résolue automatiquement.

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

#### Scenario: Prefix variants are not resolved by shape
- **GIVEN** la cible contient `legacy:s1` et `legacy:legacy:s1` comme candidates pour le même sujet
- **WHEN** l'inventaire ou le plan de réparation est construit
- **THEN** la variante est signalée comme ambiguë
- **AND** aucune des deux n'est choisie à partir du suffixe, du titre ou du contenu similaire

#### Scenario: A hidden reference is not a missing record
- **WHEN** une référence ne peut pas être résolue localement mais que les droits, le realm ou le propriétaire peuvent masquer la cible
- **THEN** elle est classée comme invisible ou indéterminée
- **AND** elle n'est pas traitée comme un enregistrement supprimé

### Requirement: Consent bound to the displayed plan

Le consentement SHALL être lié au plan **effectivement présenté**, à son empreinte source/cible, à l'identité, au périmètre, aux résolutions et à la destination. Toute divergence entre ce plan et une revalidation MUST demander une nouvelle revue. Les droits, les realms et le `remoteDbId` font partie de l'identité de destination.

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
- **WHEN** l'URL Cloud, le `remoteDbId`, l'utilisateur, ses droits ou ses realms changent
- **THEN** le plan est invalidé
- **AND** aucune donnée n'est transférée à cette nouvelle identité
- **AND** aucune réparation n'est appliquée sur cette nouvelle destination

### Requirement: Local atomicity and truthful remote status

Le commit SHALL employer des transactions IndexedDB atomiques et des insertions anti-écrasement. La réussite locale MUST NOT être confondue avec la convergence distante ou une transaction distribuée garantie. Une réparation de références SHALL employer une transaction ciblée avec vérification anti-écrasement et sans suppression.

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

#### Scenario: Repair updates only planned references
- **WHEN** une réparation de références est confirmée
- **THEN** seul le `subjectId` ou le `parentId` prévu est modifié sur les enregistrements planifiés
- **AND** aucun enregistrement n'est supprimé, renommé en masse ou remplacé par une variante arbitraire
- **AND** une modification concurrente d'un autre champ annule la transaction

## ADDED Requirements

### Requirement: Provenance-attested reference repair

L'application SHALL produire un plan de réparation prévisualisable qui n'attache un élément orphelin à un sujet ou parent existant que si la provenance sélectionnée prouve cette identité et si la personne concernée a consenti au choix. La similitude de titre, le simple retrait de préfixes ou la seule forme `legacy:` ne MUST pas servir de preuve. Le plan SHALL préserver les champs métier et remapper les références imbriquées.

#### Scenario: Preview lists sources, target and proposed mapping
- **GIVEN** un workspace incohérent et une source de provenance sélectionnée
- **WHEN** le plan de réparation est prévisualisé
- **THEN** il indique les sources, la cible, la destination/compte, la variante d'ID, le mapping proposé sujet/tâche et les changements `subjectId`/`parentId`
- **AND** il affiche les contenus à conserver, les groupes ambigus ou bloqués, les compteurs avant/après et une empreinte de plan
- **AND** aucune écriture n'est effectuée

#### Scenario: Attachment requires proven identity
- **GIVEN** une tâche orpheline dont le `subjectId` est `legacy:s1` et un sujet cible `legacy:legacy:s1`
- **WHEN** aucune source ou provenance ne prouve que ces identités désignent le même sujet
- **THEN** le groupe est ambigu et bloqué
- **AND** aucun rattachement n'est proposé à partir du titre ou du retrait de préfixe

#### Scenario: Proven source yields a deterministic proposal
- **GIVEN** une source documentaire et une provenance explicite qui produisent exactement l'identité cible du sujet
- **WHEN** le plan est construit
- **THEN** le rattachement proposé est déterministe et lié à cette source
- **AND** les références `subjectId` et `parentId` des descendants sont remappées de façon cohérente
- **AND** le choix reste soumis à un consentement explicite

#### Scenario: Ambiguous variants are reported, not decided
- **GIVEN** deux variantes d'identité ou deux contenus divergents impossibles à départager
- **WHEN** le plan est construit
- **THEN** le groupe est signalé comme ambigu ou en conflit
- **AND** aucune variante n'est choisie automatiquement
- **AND** les autres groupes indépendants restent prévisualisables

#### Scenario: Business fields survive repair planning
- **WHEN** un rattachement est proposé
- **THEN** la note, l'ordre, la priorité, l'état `done`, le parent/enfant et le contenu métier restent identiques
- **AND** seule la référence nécessaire est planifiée

### Requirement: Verified recovery backup and plan-bound repair consent

Avant toute réparation, l'application SHALL produire et vérifier une sauvegarde de récupération des enregistrements impactés, avec empreinte et comptes, indépendante de la vue de travail. Elle SHALL exiger un consentement propre au plan affiché et à la destination. Une sauvegarde absente ou invalide, un consentement périmé ou un changement de compte, d'URL, de `remoteDbId`, de droits ou de cible MUST bloquer la réparation tout en préservant la lecture et le diagnostic.

#### Scenario: Missing or invalid backup blocks repair
- **GIVEN** un plan de réparation prévisualisé
- **WHEN** la sauvegarde de récupération est absente, illisible ou ne correspond pas aux comptes/empreintes attendus
- **THEN** l'action de réparation est désactivée ou refusée
- **AND** aucune écriture n'est effectuée
- **AND** la consultation read-only et le diagnostic restent disponibles

#### Scenario: Consent is bound to the displayed plan and destination
- **GIVEN** un consentement donné pour un plan et une destination
- **WHEN** le plan affiché, l'empreinte, le compte, l'URL ou le `remoteDbId` diffèrent
- **THEN** le consentement est refusé
- **AND** aucune réparation n'est appliquée
- **AND** une nouvelle revue est requise

#### Scenario: Source or target changes after preview
- **WHEN** la source, la cible ou une référence concernée change après la prévisualisation
- **THEN** le plan est marqué périmé
- **AND** aucune écriture n'est effectuée
- **AND** les sauvegardes et les enregistrements restent intacts

#### Scenario: Permission or realm change invalidates the repair
- **WHEN** les droits ou les realms changent avant la confirmation
- **THEN** la réparation est refusée
- **AND** aucune donnée n'est écrite dans un périmètre non autorisé
- **AND** l'état reste `indeterminate` ou `not-visible-unauthorized`, jamais « supprimé »

### Requirement: Non-destructive idempotent repair

Une réparation confirmée SHALL être non destructive et idempotente. Elle MUST conserver les enregistrements divergents, bloquer toute collision ambiguë et ne MUST pas créer de sujet fictif ni rattacher par le seul nom. Une interruption, une reprise, un rechargement ou une exécution répétée SHALL ne créer aucun doublon, ne supprimer aucune tâche et laisser un état récupérable.

#### Scenario: Repeated repair creates no duplicate
- **GIVEN** une réparation de références déjà commitée
- **WHEN** le même plan est rejoué ou la page est rechargée
- **THEN** les références réparées sont reconnues
- **AND** aucune seconde réparation n'est exécutée
- **AND** aucun doublon n'est créé

#### Scenario: Late collision or transaction failure
- **GIVEN** une collision ou une modification concurrente apparaît après la revalidation
- **WHEN** la transaction de réparation s'exécute
- **THEN** l'écrasement est refusé
- **AND** la transaction entière est annulée
- **AND** les enregistrements divergents et les sauvegardes restent intacts

#### Scenario: Interruption and recovery
- **WHEN** une réparation est interrompue avant ou après son commit
- **THEN** l'état distingue non commencé, complet ou incertain
- **AND** une reprise ne répète pas aveuglément les écritures
- **AND** la lecture et l'export de récupération restent possibles

#### Scenario: No fictitious subject and no name-only attachment
- **WHEN** une référence orpheline n'a pas de cible prouvée
- **THEN** aucun sujet fictif n'est créé
- **AND** aucun rattachement n'est déduit du nom, du titre ou de la ressemblance
- **AND** le groupe reste bloqué avec un code explicite
