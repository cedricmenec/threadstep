# cloud-opt-in-activation Specification

## Purpose
Activer ultérieurement une synchronisation Dexie Cloud facultative depuis un espace IndexedDB déjà peuplé, en empêchant toute publication non consentie et toute déduction erronée sur l'état distant.
## Requirements
### Requirement: Explicit opt-in without local disruption
L'activation Cloud SHALL être une action volontaire, réversible avant transfert et distincte du premier usage local. L'application MUST préserver l'espace local existant jusqu'à la confirmation de son transfert, sans l'attacher tacitement à un addon synchronisant.
#### Scenario: User remains local indefinitely
- **GIVEN** un espace local contenant des données
- **WHEN** l'utilisateur ne choisit pas « Activer Cloud »
- **THEN** l'application fonctionne normalement sans OTP, URL ni réplication
#### Scenario: Setup is cancelled
- **WHEN** l'utilisateur abandonne l'assistant avant consentement
- **THEN** l'espace local et les données distantes restent inchangés
- **AND** aucune donnée métier locale n'a été transmise
### Requirement: Destination selection and native authentication
L'application SHALL obtenir l'URL distante et authentifier l'utilisateur avec les mécanismes clients Dexie Cloud choisis par le projet. La validation syntaxique ne SHALL PAS dépendre du réseau. Une authentification réussie MUST NOT constituer un consentement au transfert.
#### Scenario: Invalid destination
- **WHEN** l'utilisateur saisit une URL invalide, non HTTPS ou contenant des credentials
- **THEN** la destination est refusée sans altérer l'espace local
#### Scenario: Authentication is refused
- **WHEN** le service refuse l'identité, l'origine ou les permissions
- **THEN** le parcours revient dans un état récupérable sans écriture métier distante
- **AND** l'espace local autonome reste disponible
### Requirement: Isolation until transfer consent
Les données déjà saisies localement MUST rester hors de toute table ou instance déclenchant une réplication avant l'accord explicite de l'utilisateur. Le premier accès au Cloud SHALL utiliser un espace distant synchronisé séparé, ou un mécanisme d'isolation équivalent démontré et testé.
#### Scenario: Connecting addon does not upload existing local data
- **GIVEN** des données historiques en local et une cible Cloud vide ou peuplée
- **WHEN** l'addon est configuré et l'utilisateur s'authentifie
- **THEN** aucun enregistrement historique n'est rendu éligible au push avant confirmation
- **AND** aucune file de mutations historiques n'est créée dans le workspace synchronisé
#### Scenario: Eager synchronization risk
- **WHEN** la connexion native initie automatiquement un push/pull
- **THEN** elle ne peut concerner les données historiques encore non consenties
- **AND** l'implémentation ne suppose pas que `sync({purpose:"pull"})` interdit à elle seule tout push
### Requirement: Attested target discovery
Avant de qualifier la cible « vide », « peuplée » ou « en conflit », l'application SHALL établir une première lecture distante pour l'identité et l'espace autorisés. L'absence de preuve, une panne de réseau ou une erreur de lecture MUST entraîner un état « distant indéterminé ».
#### Scenario: Empty target after verified first pull
- **GIVEN** une session valide et une instance Cloud de test accessible
- **WHEN** le premier cycle de lecture native s'achève et les tables autorisées sont lues
- **THEN** le parcours peut présenter une cible vérifiée vide
- **AND** le consentement au futur transfert est toujours requis
#### Scenario: Cached IndexedDB empty but remote unknown
- **WHEN** IndexedDB synchronisé est vide mais l'état natif du pull est inconnu
- **THEN** la cible n'est pas considérée comme vide
- **AND** aucun transfert n'est planifié
#### Scenario: Remote data belongs to another scope
- **WHEN** le compte ou les droits ne correspondent pas à l'espace attendu
- **THEN** le parcours est bloqué avec explication
- **AND** il ne transmet aucun jeu de données local à cette identité
### Requirement: Review, commit and activation boundary
La copie locale vers l'espace synchronisé SHALL passer par une réconciliation liée à la destination et au plan présenté. Après commit local, le statut de transmission SHALL rester « en attente » jusqu'à preuve native. L'espace local d'origine MUST rester récupérable.
#### Scenario: User confirms import of safe groups
- **GIVEN** une première lecture distante attestée et un plan lisible
- **WHEN** l'utilisateur accepte la destination et les seules insertions identifiées
- **THEN** l'application crée ces enregistrements dans le workspace synchronisé de manière transactionnelle
- **AND** elle conserve la source locale
#### Scenario: Network fails after local commit
- **WHEN** les insertions dans IndexedDB synchronisé réussissent mais le push échoue
- **THEN** l'état dit « écrit localement, sync en attente/erreur »
- **AND** la reprise n'ajoute pas de doublons
- **AND** le workspace d'origine reste récupérable
#### Scenario: Remote changed during review
- **WHEN** un autre appareil modifie la cible après sa prévisualisation
- **THEN** le consentement précédent devient caduc
- **AND** l'application présente le nouveau plan avant toute autre insertion
### Requirement: Safe state transitions
L'assistant SHALL exposer les états local, préparation, connexion, première lecture, revue, transfert en attente, actif et échec récupérable ; un état d'erreur n'autorise jamais une purge implicite.
#### Scenario: Retry from recoverable error
- **WHEN** la connexion redevient disponible après un blocage
- **THEN** l'utilisateur peut reprendre une découverte et revalidation explicites
- **AND** les données d'origine et la destination précédemment saisie ne sont pas effacées
### Requirement: Retained historical source is not a migration order
La présence de `threadstep.document.v1` SHALL distinguer la conservation de la
source historique de la nécessité d'une migration. Une source déjà réconciliée
avec les données canoniques, ou explicitement écartée pour une empreinte de
source et une identité de destination données, MUST NOT déclencher
automatiquement une demande d'import ou de nouvelles insertions. La source
MUST rester intacte, accessible et exportable ; une différence réelle MUST
rester observable par une vérification explicite.
#### Scenario: Restored target already contains every relevant record
- **GIVEN** une cible restaurée contenant déjà tous les enregistrements pertinents
- **AND** la clé `threadstep.document.v1` est encore présente
- **WHEN** l'application réévalue la proposition après chargement, synchronisation ou rechargement
- **THEN** aucune demande d'import n'est affichée automatiquement
- **AND** aucune insertion n'est planifiée ni exécutée
- **AND** la source historique reste intacte et exportable
#### Scenario: Explicit dismissal is scoped to source and destination
- **GIVEN** un plan de réconciliation affiché pour une source et une destination
- **WHEN** l'utilisateur refuse explicitement cette proposition
- **THEN** ce refus est mémorisé pour l'empreinte de la source, l'URL,
  le `remoteDbId` et l'utilisateur authentifié
- **AND** un rechargement ou une synchronisation ultérieure ne repropose pas
  automatiquement cette migration
- **AND** `threadstep.document.v1` n'est ni supprimé ni modifié
- **AND** son export reste disponible
#### Scenario: A different source or destination reopens verification
- **GIVEN** une proposition explicitement écartée pour une source et une destination
- **WHEN** le contenu de la source, l'URL Cloud, la base distante ou le compte change
- **THEN** l'ancien écartement ne s'applique plus
- **AND** une nouvelle vérification sûre peut être proposée
- **AND** aucune donnée n'est copiée ou insérée automatiquement vers la nouvelle identité
#### Scenario: A real difference remains observable
- **GIVEN** une source historique conservée et un écartement ou un résultat déjà réconcilié
- **WHEN** l'utilisateur demande explicitement à vérifier la sauvegarde historique
- **THEN** l'inventaire courant et toute différence réelle sont affichés
- **AND** aucune écriture n'est effectuée sans une nouvelle confirmation explicite
#### Scenario: Dismissal metadata is not business data
- **WHEN** un écartement est enregistré ou relu
- **THEN** seuls une version et des clés opaques sont conservés localement
- **AND** aucun titre, note, email, OTP, jeton ni identifiant utilisateur brut
  n'est stocké ou affiché
- **AND** un stockage indisponible n'entraîne ni suppression de la source ni
  migration implicite
### Requirement: Guided activation stages

L'application SHALL présenter un assistant d'activation à étapes observables :
local, préparation, connexion/OTP, première lecture distante attestée, revue et
consentement, transfert local en attente, actif et échec récupérable. Chaque
étape MUST exposer la prochaine action permise et MUST NOT annoncer une étape
non atteinte.

#### Scenario: Local workspace remains the starting point
- **GIVEN** un espace local `threadstep-local` contenant des sujets et des étapes
- **WHEN** l'utilisateur ouvre ThreadStep sans activation Cloud
- **THEN** l'assistant n'est pas actif et les opérations locales restent disponibles
- **AND** aucune configuration, authentification ou réplication Cloud n'est tentée

#### Scenario: Activation reaches each stage only from its evidence
- **WHEN** l'utilisateur démarre l'activation, saisit une URL puis s'authentifie par OTP
- **THEN** l'interface affiche successivement la préparation, la connexion et la première lecture distante
- **AND** elle n'affiche la revue qu'après une lecture distante attestée
- **AND** elle n'affiche le transfert en attente qu'après acceptation du plan affiché

#### Scenario: Abandon before consent leaves both workspaces intact
- **GIVEN** un assistant parvenu à l'étape de revue
- **WHEN** l'utilisateur annule avant de confirmer le plan
- **THEN** aucune écriture de transfert n'est effectuée dans l'espace synchronisé
- **AND** l'espace local et la cible distante restent inchangés
- **AND** l'application revient à un état récupérable sans effacer l'URL ni les données locales

### Requirement: Local source isolated until transfer consent

Tant que le plan de transfert n'a pas été explicitement accepté, les
enregistrements locaux MUST rester dans l'espace autonome non répliqué. La
configuration de l'addon, l'OTP et le premier pull SHALL NOT placer ces
enregistrements dans une table synchronisée, créer une file de mutations
historiques, ni les attacher à l'instance Cloud.

#### Scenario: Configuration and OTP expose no historical record
- **GIVEN** des sujets et étapes créés dans `threadstep-local`
- **WHEN** l'utilisateur enregistre une URL Cloud valide puis termine l'OTP
- **THEN** l'espace synchronisé ne contient aucun de ces enregistrements
- **AND** aucune mutation historique n'est en attente de push
- **AND** l'espace local reste lisible et exportable

#### Scenario: First pull does not push local history
- **GIVEN** une cible Cloud accessible et des données locales non consenties
- **WHEN** la lecture distante initiale est exécutée et attestée
- **THEN** seuls les enregistrements distants autorisés deviennent visibles dans l'espace synchronisé
- **AND** aucun enregistrement local antérieur au consentement n'est envoyé
- **AND** l'application ne suppose pas que `sync({ purpose: "pull" })` empêche à lui seul un push historique

#### Scenario: Cached empty target is not consent or proof
- **GIVEN** l'IndexedDB synchronisée est vide et la lecture initiale n'est pas attestée
- **WHEN** l'assistant évalue la cible
- **THEN** la cible est déclarée indéterminée, jamais vérifiée vide
- **AND** aucun transfert n'est proposé ni exécuté

### Requirement: Attested target classification

Après une première lecture native attestée, l'application SHALL classer la cible
comme vide vérifiée, peuplée, divergente, indisponible/indéterminée ou liée à un
autre compte/périmètre. Une absence de preuve, une erreur de lecture ou des
signaux de session contradictoires MUST produire un état bloqué ou indéterminé.

#### Scenario: Verified empty target
- **GIVEN** une session et une instance autorisées
- **WHEN** le premier cycle de lecture s'achève avec une révision serveur connue et aucune donnée métier
- **THEN** l'assistant présente une cible vérifiée vide
- **AND** il exige toujours le consentement au plan de transfert

#### Scenario: Populated or divergent target
- **GIVEN** une cible attestée contenant déjà des sujets ou des étapes
- **WHEN** l'inventaire compare la source locale et la cible
- **THEN** les enregistrements identiques, absents, divergents et propres à la cible sont distingués
- **AND** seuls les groupes indépendants et sûrs peuvent être proposés à l'insertion
- **AND** aucun enregistrement existant n'est écrasé ou supprimé

#### Scenario: Target unavailable or unreadable
- **WHEN** le service est hors ligne, refuse la lecture ou ne fournit pas de signal initial exploitable
- **THEN** l'assistant bloque la revue et le transfert avec une catégorie compréhensible
- **AND** il ne conclut jamais que la cible est vide
- **AND** la source locale reste intacte

#### Scenario: Target belongs to another account or scope
- **GIVEN** l'utilisateur, l'URL, le `remoteDbId` ou les realms disponibles ne correspondent pas à la cible attendue
- **WHEN** l'assistant vérifie l'identité de destination
- **THEN** il bloque le parcours avec une explication
- **AND** il ne transmet aucun enregistrement local à cette identité

### Requirement: Review and plan-bound consent for local records

Le transfert SHALL présenter la destination normalisée, le `remoteDbId`
disponible, les compteurs source/cible, les insertions prévues, les conflits et
les groupes bloqués. Le consentement MUST porter sur ce plan affiché et sur son
identité de destination ; la réussite de l'OTP ou une cible vide MUST NOT valoir
consentement.

#### Scenario: Consent displays the exact transfer scope
- **GIVEN** une cible attestée et une source locale
- **WHEN** l'assistant affiche le plan de transfert
- **THEN** il indique la destination, la base distante disponible, les compteurs et les opérations proposées
- **AND** aucune écriture n'est effectuée avant une action de confirmation distincte

#### Scenario: Plan changes between preview and confirmation
- **GIVEN** un plan de transfert affiché et accepté
- **WHEN** la source, la cible, la destination, l'utilisateur, les droits, les realms ou les opérations ordonnées changent avant le commit
- **THEN** l'ancien consentement est refusé
- **AND** aucun enregistrement n'est inséré
- **AND** un nouveau plan est présenté pour une nouvelle revue explicite

#### Scenario: Only planned insertions are committed
- **GIVEN** un consentement valide lié au plan affiché
- **WHEN** le transfert est exécuté
- **THEN** seules les insertions `add` prévues sont écrites dans l'espace synchronisé
- **AND** la transaction est atomique
- **AND** la source locale est conservée

### Requirement: Interruption, reload and idempotent resume

Une interruption, un rechargement ou une reprise SHALL revalider la source, la
cible et la destination avant toute nouvelle écriture. Une opération déjà
transférée MUST NOT être rejouée en doublon, et un échec MUST laisser un état
récupérable sans purge implicite.

#### Scenario: Reload during review
- **WHEN** la page est rechargée après une lecture distante mais avant confirmation
- **THEN** le consentement en mémoire est perdu
- **AND** la source et la cible sont relues avant toute nouvelle proposition
- **AND** une nouvelle revue explicite est requise

#### Scenario: Resume after interruption
- **GIVEN** un transfert interrompu avant ou pendant le commit
- **WHEN** l'utilisateur reprend l'activation
- **THEN** l'application distingue non commencé, complet et incertain
- **AND** elle ne répète pas aveuglément les insertions déjà présentes
- **AND** la source locale, la cible et les sauvegardes restent récupérables

#### Scenario: URL or session changes during activation
- **WHEN** l'URL, l'utilisateur ou la base distante change après la prévisualisation
- **THEN** le plan et son consentement sont invalidés
- **AND** aucune donnée n'est copiée vers la nouvelle destination
- **AND** l'ancien espace local reste intact

### Requirement: Activation preserves the autonomous source

Après le transfert, l'application SHALL conserver l'espace local d'origine
récupérable et exportable. Une activation réussie, une erreur distante ou une
annulation MUST NOT purger implicitement les données locales ni la sauvegarde
historique.

#### Scenario: Source survives successful activation
- **GIVEN** un transfert consenti et commité localement
- **WHEN** l'activation se poursuit ou se termine
- **THEN** les données de l'espace local d'origine restent lisibles ou exportables
- **AND** aucune purge locale n'est effectuée
- **AND** aucune suppression distante n'est créée par cette conservation

#### Scenario: Failure after local commit
- **WHEN** les insertions dans l'IndexedDB synchronisée réussissent mais le push ou la synchronisation échoue
- **THEN** l'état indique que le transfert est écrit localement et que la synchronisation est en attente ou en erreur
- **AND** il n'annonce pas un push distant réussi
- **AND** la reprise n'ajoute pas de doublons

## Notes d'intégration
La séparation des workspaces peut utiliser des IndexedDB distinctes. Dexie Cloud ajoute par défaut un suffixe lié à l'URL à la base synchronisée ; ne pas le désactiver sans justification et tests. Le projet doit démontrer ses garanties d'absence de push pré-consentement dans un navigateur réel.
