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
## Notes d'intégration
La séparation des workspaces peut utiliser des IndexedDB distinctes. Dexie Cloud ajoute par défaut un suffixe lié à l'URL à la base synchronisée ; ne pas le désactiver sans justification et tests. Le projet doit démontrer ses garanties d'absence de push pré-consentement dans un navigateur réel.
