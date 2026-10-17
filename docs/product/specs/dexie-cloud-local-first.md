# Local-first Persistence, Authentication and Synchronization with Dexie Cloud

## Purpose

Définir un socle technique générique local-first permettant à une application web de persister ses données dans IndexedDB via Dexie.js et de bénéficier de l'authentification, de la synchronisation multi-appareils et du contrôle d'accès fournis par Dexie Cloud, sans backend applicatif personnalisé.

Ce socle SHALL garantir :

- Une persistance locale versionnée, indépendante de la disponibilité du réseau après initialisation et authentification.
- Une configuration locale explicite de l'instance Dexie Cloud utilisée.
- Une authentification exclusivement basée sur un code à usage unique (OTP) transmis par email.
- Une synchronisation bidirectionnelle gérée par Dexie Cloud.
- Des écritures locales non bloquantes vis-à-vis du réseau.
- Une visibilité explicite sur l'état de synchronisation.
- Une séparation entre déconnexion, changement de base et purge locale.
- La préservation des données existantes lors d'un changement de configuration.
- Un diagnostic technique minimal.
- L'absence de secrets techniques dans les ressources livrées au navigateur.

Le socle SHALL être indépendant du domaine métier, du framework frontend et du schéma fonctionnel de l'application intégratrice.

Le nom de base locale, les tables métier et leurs versions de schéma SHALL être définis par l'application intégratrice.

## Requirements

### Requirement: Base locale Dexie versionnée

L'application SHALL utiliser Dexie.js comme couche unique d'accès à IndexedDB pour ses données métier interactives.

Elle SHALL déclarer un schéma explicite et versionné, compatible avec Dexie Cloud.

Les tables synchronisées MUST utiliser des identifiants globalement uniques, compatibles avec les conventions Dexie Cloud, et MUST NOT employer de clé primaire auto-incrémentée `++id`.

L'application MUST attendre la présence d'une configuration locale Dexie Cloud syntaxiquement valide avant de construire ou d'ouvrir l'instance Dexie synchronisée.

#### Scenario: Ouverture de la base locale configurée

- **WHEN** l'application démarre avec une URL Dexie Cloud locale valide
- **THEN** la base IndexedDB est initialisée via Dexie.js
- **AND** le schéma déclaré possède une version explicite
- **AND** les tables synchronisées utilisent des identifiants globalement uniques
- **AND** aucune table synchronisée n'utilise `++id`
- **AND** Dexie Cloud est configuré avant toute opération nécessitant l'ouverture de la base

#### Scenario: Configuration absente ou invalide

- **WHEN** l'application démarre sans URL Dexie Cloud locale syntaxiquement valide
- **THEN** aucune instance Dexie synchronisée n'est construite ou ouverte
- **AND** un écran de configuration obligatoire est affiché
- **AND** aucune opération métier dépendant de la base synchronisée n'est exécutée

#### Scenario: Évolution du schéma

- **WHEN** une nouvelle version applicative introduit une modification du schéma local
- **THEN** l'application utilise le mécanisme de versionnement Dexie.js
- **AND** toute migration nécessaire est explicitement définie et compatible avec les données existantes
- **AND** les données existantes ne sont pas supprimées implicitement pour résoudre une incompatibilité de schéma

### Requirement: Configuration locale de Dexie Cloud

L'application SHALL permettre à l'utilisateur de renseigner l'URL de l'instance Dexie Cloud à utiliser.

Cette URL SHALL être conservée dans un stockage local non synchronisé, associé à l'origine du navigateur.

L'application SHALL valider le format de l'URL avant son utilisation et SHALL exiger une URL HTTPS compatible avec le service Dexie Cloud.

La validation syntaxique MUST NOT nécessiter une connexion réseau, afin de permettre la réouverture d'une base déjà configurée en mode hors connexion.

L'URL SHALL être transmise à `db.cloud.configure()` via l'option `databaseUrl`.

#### Scenario: Première configuration

- **WHEN** aucune URL Dexie Cloud n'est enregistrée
- **THEN** l'application demande à l'utilisateur de saisir une URL
- **AND** elle vérifie sa validité syntaxique
- **AND** elle conserve localement l'URL validée
- **AND** elle initialise ensuite la base synchronisée à partir de cette configuration

#### Scenario: Redémarrage avec configuration existante

- **WHEN** une URL Dexie Cloud valide est déjà enregistrée localement
- **THEN** l'application réutilise automatiquement cette URL
- **AND** elle initialise la base locale correspondante sans demander une nouvelle configuration

#### Scenario: Configuration inaccessible

- **WHEN** l'URL configurée est syntaxiquement valide mais que le service distant est inaccessible
- **THEN** l'application signale le problème de connexion ou de synchronisation
- **AND** elle ne supprime ni la configuration locale ni les bases IndexedDB existantes
- **AND** une base locale déjà initialisée reste disponible selon les conditions d'authentification et d'accès applicables

### Requirement: Authentification exclusivement par OTP email

L'application SHALL utiliser le mécanisme natif d'authentification Dexie Cloud avec `requireAuth: true`.

Dans la présente version du socle, **le seul mode d'authentification supporté SHALL être le code à usage unique (One-Time Password, OTP) envoyé par email**.

Le processus d'authentification SHALL reposer sur :

1. La saisie de l'adresse email de l'utilisateur.
2. L'envoi d'un OTP par Dexie Cloud à cette adresse.
3. La saisie du code reçu.
4. La vérification du code par Dexie Cloud.
5. L'établissement d'une session authentifiée.

L'application MUST NOT proposer de connexion par mot de passe, OAuth, fournisseur d'identité social, passkey ou mécanisme d'authentification personnalisé.

Elle SHALL utiliser le flux OTP natif de Dexie Cloud, sans implémenter de service d'authentification applicatif.

Les autres mécanismes éventuellement disponibles côté service Dexie Cloud MUST NOT être exposés comme options de connexion par l'application.

#### Scenario: Authentification initiale par email

- **WHEN** l'utilisateur accède à une base configurée sans disposer d'une session authentifiée valide
- **THEN** l'application présente le parcours d'authentification par email
- **AND** l'utilisateur peut demander l'envoi d'un OTP
- **AND** Dexie Cloud prend en charge l'envoi et la vérification du code
- **AND** une session authentifiée est établie après validation du code

#### Scenario: Code OTP incorrect ou expiré

- **WHEN** l'utilisateur saisit un OTP invalide ou expiré
- **THEN** l'authentification est refusée
- **AND** un message d'erreur compréhensible est présenté
- **AND** l'utilisateur peut recommencer le processus d'authentification selon les possibilités offertes par Dexie Cloud
- **AND** aucune donnée locale historique n'est supprimée

#### Scenario: Reprise d'une session existante

- **WHEN** l'utilisateur ouvre l'application avec une session Dexie Cloud encore valide
- **THEN** la session existante est réutilisée
- **AND** aucune nouvelle saisie d'OTP n'est imposée inutilement
- **AND** l'accès aux données respecte les permissions associées à l'identité authentifiée

#### Scenario: Absence de première authentification hors connexion

- **WHEN** l'utilisateur ouvre l'application hors connexion sans session préalablement établie
- **THEN** l'application indique que l'authentification initiale nécessite une connexion
- **AND** elle ne simule pas une authentification réussie
- **AND** elle ne contourne pas `requireAuth: true`

### Requirement: Synchronisation via Dexie Cloud

L'application SHALL utiliser `dexie-cloud-addon` pour synchroniser les tables déclarées comme synchronisées avec la base Dexie Cloud configurée.

La synchronisation SHALL être bidirectionnelle et SHALL respecter les permissions et les règles de contrôle d'accès définies par Dexie Cloud.

Le frontend SHALL communiquer directement avec Dexie Cloud pour les opérations d'authentification et de synchronisation.

Aucun backend applicatif personnalisé MUST être nécessaire pour ces opérations.

#### Scenario: Synchronisation après authentification

- **WHEN** l'utilisateur est authentifié auprès de Dexie Cloud
- **AND** la connexion réseau permet d'accéder au service
- **THEN** Dexie Cloud peut synchroniser les modifications locales vers la base distante
- **AND** les modifications distantes autorisées peuvent être récupérées localement
- **AND** les permissions associées à l'identité sont respectées

#### Scenario: Synchronisation entre appareils

- **WHEN** un utilisateur possède plusieurs appareils configurés sur la même base Dexie Cloud
- **AND** il accède aux données avec les permissions nécessaires
- **THEN** les modifications synchronisées sur un appareil deviennent disponibles sur les autres après synchronisation
- **AND** l'application n'implémente pas de protocole de synchronisation propriétaire

#### Scenario: Connexion refusée

- **WHEN** Dexie Cloud refuse l'accès en raison de l'identité, des permissions ou de l'origine du frontend
- **THEN** l'application présente une erreur appropriée
- **AND** elle n'essaie pas de contourner les contrôles d'accès
- **AND** les bases locales historiques ne sont pas supprimées

### Requirement: Écritures locales non bloquantes

L'application SHALL adopter une stratégie local-first pour les opérations de création, de modification et de suppression des données métier.

Une écriture SHALL être considérée comme enregistrée localement dès que la transaction Dexie correspondante est validée.

La confirmation d'enregistrement local MUST NOT dépendre d'un accusé de réception de Dexie Cloud.

L'interface SHALL distinguer l'enregistrement local de la synchronisation distante.

#### Scenario: Enregistrement hors connexion

- **GIVEN** la base a été initialisée et l'utilisateur dispose d'une session permettant l'accès local
- **WHEN** l'appareil est hors connexion
- **AND** l'utilisateur enregistre une modification
- **THEN** la transaction locale Dexie peut être validée sans accès réseau
- **AND** l'interface confirme l'enregistrement sur cet appareil
- **AND** la modification reste en attente de synchronisation

#### Scenario: Reprise du réseau

- **WHEN** des modifications locales attendent leur synchronisation
- **AND** le service Dexie Cloud redevient accessible
- **THEN** la synchronisation peut reprendre
- **AND** les modifications sont transmises selon les mécanismes Dexie Cloud
- **AND** l'interface reflète le nouvel état de synchronisation

#### Scenario: Échec de transaction locale

- **WHEN** une transaction IndexedDB échoue
- **THEN** l'application ne présente pas l'opération comme enregistrée
- **AND** une erreur d'enregistrement local est affichée
- **AND** cette erreur reste distincte d'une erreur de synchronisation réseau

### Requirement: Indicateur global de synchronisation explicite

L'application SHALL afficher un indicateur global reflétant l'état réel de synchronisation Dexie Cloud.

Cet indicateur SHALL s'appuyer sur les informations exposées par `db.cloud.syncState` et, lorsque nécessaire, sur les informations de connectivité disponibles.

L'interface SHALL distinguer au minimum :

- **Enregistré localement** : la transaction locale a réussi, indépendamment de son état de synchronisation.
- **En attente de synchronisation** : des changements locaux ne sont pas encore confirmés comme synchronisés.
- **Synchronisation en cours** : un échange de données est en cours.
- **Synchronisé** : Dexie Cloud indique que la base est synchronisée.
- **Hors connexion** : la synchronisation ne peut actuellement pas communiquer avec le service.
- **Erreur de synchronisation** : une erreur empêche ou perturbe la synchronisation.

L'état d'enregistrement local SHALL rester conceptuellement distinct de l'état global de synchronisation.

L'application MUST NOT déduire qu'une synchronisation est terminée uniquement parce que le navigateur indique être connecté au réseau.

#### Scenario: Écriture locale en attente

- **WHEN** une transaction locale réussit
- **AND** sa synchronisation distante n'est pas confirmée
- **THEN** l'interface indique que les données sont enregistrées localement
- **AND** elle présente un état de synchronisation en attente approprié

#### Scenario: Synchronisation active

- **WHEN** Dexie Cloud indique une phase de synchronisation active
- **THEN** l'indicateur global affiche un état de synchronisation en cours
- **AND** il ne présente pas prématurément les données comme synchronisées

#### Scenario: Erreur de synchronisation

- **WHEN** une synchronisation échoue après la réussite d'une écriture locale
- **THEN** l'interface affiche une erreur de synchronisation
- **AND** elle n'indique pas que l'enregistrement local a échoué
- **AND** elle propose une action permettant de relancer la synchronisation
- **AND** cette relance utilise les mécanismes natifs Dexie Cloud

#### Scenario: Retour à un état synchronisé

- **WHEN** Dexie Cloud confirme la fin des opérations de synchronisation
- **THEN** l'indicateur affiche l'état synchronisé
- **AND** aucune synchronisation distante supplémentaire n'est supposée en attente sur la seule base d'une ancienne erreur

### Requirement: Déconnexion distincte de la purge locale

L'application SHALL exposer deux actions distinctes :

- **Déconnexion** : mettre fin à la session utilisateur via le mécanisme natif Dexie Cloud.
- **Purge locale** : supprimer volontairement les données locales de la base sélectionnée sur l'appareil.

La déconnexion SHALL utiliser `db.cloud.logout()`.

Elle MUST NOT être implémentée comme un appel explicite à une procédure de purge de toutes les bases locales.

L'application SHALL tenir compte du comportement natif de Dexie Cloud lors de la déconnexion, notamment du risque de perte des changements non synchronisés.

La purge locale MUST NOT supprimer les données distantes.

Elle MUST NOT être implémentée par des suppressions d'enregistrements métier susceptibles d'être propagées à la base distante par synchronisation.

#### Scenario: Déconnexion utilisateur

- **WHEN** l'utilisateur déclenche la déconnexion
- **THEN** l'application utilise le mécanisme de déconnexion Dexie Cloud
- **AND** la session authentifiée prend fin
- **AND** les données distantes restent intactes
- **AND** l'action n'entraîne aucune suppression explicite d'une autre base locale associée à une URL différente

#### Scenario: Déconnexion avec modifications non synchronisées

- **WHEN** l'utilisateur demande une déconnexion alors que des modifications locales ne sont pas synchronisées
- **THEN** l'application signale le risque de perte de ces modifications
- **AND** une confirmation explicite est demandée si la déconnexion peut entraîner leur perte
- **AND** l'utilisateur peut annuler l'opération

#### Scenario: Purge locale contrôlée

- **WHEN** l'utilisateur déclenche la purge locale
- **THEN** l'application présente une confirmation explicite
- **AND** elle identifie la base locale concernée
- **AND** elle avertit de la perte potentielle des modifications non synchronisées
- **AND** après confirmation, elle supprime localement les données de la base sélectionnée sans générer de suppressions synchronisées
- **AND** aucune suppression distante n'est demandée
- **AND** les bases locales associées à d'autres URL restent intactes

#### Scenario: Récupération après purge

- **WHEN** une base locale a été purgée
- **AND** l'utilisateur se reconnecte à la même base Dexie Cloud
- **THEN** les données présentes sur le service distant peuvent être récupérées
- **AND** les données qui n'avaient jamais été synchronisées ne sont pas présentées comme récupérables depuis le service distant

### Requirement: Diagnostic technique minimal

L'application SHALL fournir une vue de diagnostic technique accessible à l'utilisateur.

Cette vue SHALL afficher au minimum :

- La version de l'application.
- Le nom effectif de la base IndexedDB locale.
- L'URL Dexie Cloud configurée.
- L'identité utilisateur actuellement connectée, si disponible.
- L'état de connectivité réseau.
- L'état courant de synchronisation Dexie Cloud.

La vue SHALL présenter les informations de manière compréhensible, sans exposer de secrets ni de données métier détaillées.

#### Scenario: Consultation du diagnostic

- **WHEN** l'utilisateur ouvre la vue diagnostic
- **THEN** les informations techniques minimales sont affichées
- **AND** les valeurs reflètent l'état courant de l'application
- **AND** aucune donnée métier détaillée n'est exposée
- **AND** aucun OTP, token d'authentification ou secret technique n'est affiché

#### Scenario: Diagnostic sans configuration

- **WHEN** l'utilisateur ouvre la vue diagnostic alors qu'aucune base Dexie Cloud n'est configurée
- **THEN** la vue indique explicitement l'absence de configuration
- **AND** elle n'initialise pas de base synchronisée pour obtenir les informations manquantes

### Requirement: Frontière de sécurité frontend

Le frontend MUST NOT embarquer de secret machine Dexie Cloud, d'identifiant d'administration privilégié, de token administratif ou de credential technique destiné aux opérations serveur.

En particulier, les fichiers `dexie-cloud.key` et `dexie-cloud.json` MUST NOT être intégrés aux ressources statiques livrées au navigateur.

L'application MUST NOT intégrer au build une URL Dexie Cloud utilisateur imposée.

L'URL de synchronisation SHALL être obtenue à l'exécution depuis la configuration locale de l'utilisateur.

L'application SHALL utiliser exclusivement les mécanismes d'authentification client prévus par Dexie Cloud.

#### Scenario: Vérification du build

- **WHEN** un développeur inspecte les sources frontend et le build statique
- **THEN** aucun secret machine ni credential administratif n'est présent
- **AND** aucun token d'administration n'est embarqué
- **AND** aucune URL Dexie Cloud utilisateur n'est imposée par le bundle
- **AND** les fichiers `dexie-cloud.key` et `dexie-cloud.json` sont absents des ressources distribuées

#### Scenario: Persistance de l'URL utilisateur

- **WHEN** l'utilisateur valide une URL Dexie Cloud
- **THEN** cette URL est enregistrée dans un stockage local de l'origine du navigateur
- **AND** elle n'est pas écrite dans une table synchronisée
- **AND** elle n'est pas transmise à un backend applicatif de configuration

#### Scenario: Authentification sans secret applicatif

- **WHEN** l'utilisateur s'authentifie par OTP email
- **THEN** le frontend utilise le mécanisme d'authentification Dexie Cloud
- **AND** aucun secret machine ou credential administratif n'est nécessaire côté navigateur
- **AND** la gestion des sessions et des tokens repose sur Dexie Cloud

### Requirement: Sélection non destructive de la base Dexie Cloud

L'application SHALL préserver les bases locales existantes lors de la configuration initiale ou du changement d'URL Dexie Cloud.

Elle SHALL conserver un nom de base Dexie stable pour une même application et SHALL utiliser le suffixage natif de Dexie Cloud permettant d'associer une base IndexedDB à une base distante.

L'option `nameSuffix` MUST NOT être désactivée.

La sélection d'une URL différente SHALL entraîner l'utilisation de la base IndexedDB correspondante sans supprimer les bases locales précédemment utilisées.

Une nouvelle sélection d'URL MUST NOT déclencher à elle seule une migration de schéma ou une copie de données entre bases.

Les éventuelles migrations normales dues à l'évolution explicite du schéma applicatif restent autorisées.

#### Scenario: Reprise d'une base existante

- **WHEN** l'utilisateur configure une URL Dexie Cloud déjà utilisée par l'application
- **AND** le nom de base Dexie et les conventions de suffixage sont inchangés
- **THEN** Dexie Cloud sélectionne la même base IndexedDB locale suffixée par l'identifiant distant
- **AND** aucune copie de données n'est réalisée uniquement en raison de cette sélection
- **AND** les données et la session existantes peuvent être retrouvées lorsqu'elles sont encore présentes et valides

#### Scenario: Sélection d'une autre URL

- **WHEN** l'utilisateur confirme une URL Dexie Cloud différente
- **THEN** la nouvelle configuration est enregistrée localement
- **AND** l'application réinitialise proprement son contexte Dexie, notamment par rechargement si nécessaire
- **AND** une base IndexedDB distincte est sélectionnée
- **AND** l'ancienne base IndexedDB reste intacte
- **AND** aucune donnée n'est copiée automatiquement entre les deux bases

#### Scenario: Retour à une URL précédente

- **WHEN** l'utilisateur reconfigure une URL précédemment utilisée
- **THEN** l'application sélectionne à nouveau la base IndexedDB correspondante
- **AND** les données locales encore présentes peuvent être réutilisées
- **AND** aucune restauration destructive ni réinitialisation implicite n'est exécutée

#### Scenario: Nouvelle URL inaccessible

- **WHEN** l'utilisateur sélectionne une autre URL Dexie Cloud
- **AND** cette URL est inaccessible ou refuse l'authentification
- **THEN** l'application présente l'erreur correspondante
- **AND** elle ne supprime aucune base IndexedDB historique
- **AND** l'utilisateur conserve la possibilité de sélectionner à nouveau une URL précédente

### Requirement: Validation automatisée des garanties du socle

L'implémentation SHALL disposer de tests vérifiant les garanties techniques essentielles du socle local-first.

Ces tests SHALL couvrir au minimum :

- L'absence d'initialisation de la base synchronisée sans configuration locale valide.
- Le versionnement explicite du schéma Dexie.
- L'absence de clés `++id` dans les tables synchronisées.
- La configuration Dexie Cloud avec `requireAuth: true`.
- L'utilisation exclusive du parcours OTP email.
- La réussite des écritures locales sans dépendance à un accusé réseau.
- La distinction entre erreur locale et erreur de synchronisation.
- L'absence de suppression distante lors d'une purge locale.
- La préservation des bases IndexedDB lors d'un changement d'URL.
- L'absence de secrets et de fichiers de configuration Dexie Cloud sensibles dans le build.

#### Scenario: Validation de l'intégration

- **WHEN** les tests du socle sont exécutés
- **THEN** les comportements obligatoires sont vérifiés par des tests automatisés appropriés
- **AND** les scénarios destructifs sont exécutés dans des environnements ou bases de test isolés
- **AND** aucun test ne doit effacer une base Dexie Cloud de production
