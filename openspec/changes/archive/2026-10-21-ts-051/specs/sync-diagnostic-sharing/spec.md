# sync-diagnostic-sharing Specification

## Purpose

Permettre à l'utilisateur de copier, depuis la page de synchronisation, un
rapport de diagnostic structuré et expurgé pour demander une assistance, y
compris lorsque la session ou la première synchronisation reste bloquée, sans
effet sur les données ni sur le Cloud.

## ADDED Requirements

### Requirement: Always-available on-demand report action

La section « Diagnostic de synchronisation » SHALL proposer un bouton explicite
« Copier le diagnostic pour assistance », visible, activable et sans navigation
dans tous les états transitoires, hors ligne et en erreur. La disponibilité de
la copie MUST NOT dépendre d'une session authentifiée ni d'une lecture
distante réussie. Le rapport SHALL n'être calculé qu'à une action explicite de
l'utilisateur.

#### Scenario: Copy action during a blocked bootstrap

- **GIVEN** la session est en `loading`, la connexion en `connecting`, la phase native en `initial` et le pull initial en attente
- **WHEN** l'utilisateur ouvre `#/parametres/synchronisation`
- **THEN** le bouton « Copier le diagnostic pour assistance » est visible et activable
- **AND** il ne requiert ni authentification, ni pull terminé, ni lecture distante
- **AND** aucun rapport n'est construit avant l'action de l'utilisateur

#### Scenario: Copy action while offline or in error

- **GIVEN** le navigateur est hors ligne ou le diagnostic affiche une erreur classée
- **WHEN** l'utilisateur consulte la page de synchronisation
- **THEN** le bouton de copie reste visible et activable
- **AND** son activation produit un rapport à partir des seuls signaux disponibles
- **AND** elle ne tente aucun appel réseau pour enrichir le rapport

#### Scenario: Copy action without Cloud configuration

- **GIVEN** aucun espace Cloud n'est configuré
- **WHEN** l'utilisateur active « Copier le diagnostic pour assistance »
- **THEN** le rapport indique que la synchronisation Cloud n'est pas activée
- **AND** il conserve les informations locales disponibles sans inventer d'état distant
- **AND** aucune instance Cloud n'est ouverte ou configurée par cette action

### Requirement: Structured diagnostic report content

Le rapport SHALL être un texte Markdown lisible avec des sections stables et
des clés identifiables, incluant les horodatages local et UTC, l'espace actif
anonymisé, le réseau, la session, la connexion, la phase native, le pull
initial, les écritures locales, la preuve distante et sa raison, la liaison de
compte, les erreurs normalisées, le bootstrap, la relance et sa raison.

#### Scenario: Complete report from available signals

- **GIVEN** un espace synchronisé expose une session, une connexion, une phase, un pull et une liaison
- **WHEN** l'utilisateur copie le diagnostic
- **THEN** le rapport contient chaque dimension dans une section ou une clé distincte
- **AND** l'horodatage local et l'horodatage UTC sont présents
- **AND** les erreurs sont représentées par des catégories et codes normalisés
- **AND** la preuve distante et sa raison sont explicites
- **AND** aucun message serveur brut, aucune stack et aucun contenu métier n'apparaissent

### Requirement: Explicit unavailable values and browser context

Toute mesure, version/build ou champ natif absent SHALL valoir `non disponible`
et toute cause non prouvée SHALL rester `indéterminée`. Le contexte navigateur
MUST rester non identifiant et se limiter à une famille et une version majeure
si elles sont déterminables sans interrogation externe.

#### Scenario: Missing values are never invented

- **GIVEN** une mesure, une version/build ou un champ natif n'est pas disponible
- **WHEN** le rapport est produit
- **THEN** la valeur correspondante est `non disponible`
- **AND** une cause non prouvée est présentée comme `indéterminée`
- **AND** aucune valeur courante, aucun succès et aucune donnée distante ne sont déduits de l'absence

#### Scenario: Browser context stays non-identifying

- **GIVEN** le navigateur expose un agent utilisateur
- **WHEN** le rapport décrit le contexte navigateur
- **THEN** il ne contient au plus que la famille et la version majeure du navigateur
- **AND** l'agent complet, la plateforme détaillée, la langue et les autres champs identifiants sont absents
- **AND** la valeur est `non disponible` si la famille ne peut pas être déterminée sans interrogation externe

### Requirement: Report refresh stays current

Un nouveau rendu du diagnostic SHALL rendre accessibles le dernier rapport et
un aperçu encore valide sans réutiliser un contenu antérieur devenu faux. Le
rendu MUST NOT déclencher de copie ni d'action Cloud.

#### Scenario: Report remains readable on a re-render

- **GIVEN** le diagnostic a déjà produit un rapport
- **WHEN** un signal natif provoque un nouveau rendu de la page
- **THEN** l'aperçu et le dernier rapport restent accessibles sans contenu antérieur devenu faux
- **AND** aucune action de copie n'est déclenchée par le rendu
- **AND** le rapport suivant reflète les signaux courants

### Requirement: Truthful session, cache and remote evidence

Le rapport SHALL distinguer la session en cours de restauration, la session
absente, la session expirée et un refus natif explicitement constaté. Il MUST
présenter séparément le fait observé, la cause encore indéterminée et les
vérifications non destructives suggérées, sans promettre de récupération. Un
état de phase native MUST NOT être présenté comme un succès distant attesté.

#### Scenario: Android incident of 21 October is explained without false conclusions

- **GIVEN** la session est en restauration ou non authentifiée, le pull initial est en attente
- **AND** la lecture distante n'est pas attestée
- **WHEN** le rapport est copié
- **THEN** il indique la session observée et le pull en attente
- **AND** il indique que la lecture distante n'est pas attestée
- **AND** il ne déclare pas que le Cloud est vide
- **AND** il ne propose aucune migration, purge, récupération ou autre action destructive

#### Scenario: Absence of identity is not a native refusal

- **GIVEN** aucun refus natif n'a été explicitement observé
- **WHEN** le rapport décrit la session
- **THEN** il présente le fait observé et une cause `indéterminée`
- **AND** il rappelle que le libellé historique « session absente ou refusée » ne prouve pas un refus serveur
- **AND** il ne présente pas l'absence d'identité comme un refus de Dexie Cloud

#### Scenario: Explicit native refusal is reported as observed

- **GIVEN** un refus d'origine ou de permission a été explicitement constaté
- **WHEN** le rapport décrit la session et les erreurs
- **THEN** le refus est présenté comme un fait observé avec sa catégorie normalisée
- **AND** il reste distinct d'une simple absence d'identité ou d'une expiration
- **AND** aucune récupération automatique n'est annoncée

#### Scenario: Native phase does not prove remote success

- **GIVEN** la phase native est `in-sync` ou une autre phase favorable
- **WHEN** aucune preuve distante exploitable n'est disponible
- **THEN** le rapport indique que la preuve distante est absente ou non attestée
- **AND** il ne déclare pas de succès distant, de base peuplée ni de convergence
- **AND** il n'annonce pas que les données sont présentes sur un autre appareil

#### Scenario: Missing proof, masked cache and empty local base stay distinct

- **GIVEN** le diagnostic présente une absence de preuve, un cache `UNVERIFIED` ou une base locale vide
- **WHEN** le rapport est produit
- **THEN** il nomme séparément l'absence de preuve, le cache masqué ou non vérifié et la base locale vide observée
- **AND** il précise qu'une base distante vide n'est pas attestée par ce diagnostic
- **AND** il n'affirme ni perte locale ni suppression du cache

#### Scenario: Safe checks do not promise recovery

- **GIVEN** un blocage de session, de réseau ou de configuration est décrit
- **WHEN** le rapport propose des vérifications
- **THEN** elles se limitent à des constats non destructifs sur la session, le réseau et la persistance de la configuration
- **AND** elles ne promettent pas de récupération
- **AND** elles n'exécutent aucune action et ne proposent aucune purge ou migration

### Requirement: Bounded in-memory bootstrap lifecycle observations

Lorsque des signaux non sensibles ont été observés, le rapport SHALL décrire
l'ouverture de la base effective et l'authentification native : `db.open()`
non démarré, en attente, résolu ou en échec, l'émission initiale et le dernier
changement des observables `currentUser`, `syncState` et `persistedSyncState`,
ainsi que le lancement et l'issue d'une demande OTP. Les âges SHALL être
arrondis et bornés ; sans mesure, la valeur MUST être `non disponible`.

#### Scenario: Database opening and observables are described

- **GIVEN** `db.open()` a été lancé puis résolu, et les observables ont émis
- **WHEN** le rapport est produit
- **THEN** l'ouverture est indiquée comme résolue avec un âge borné
- **AND** l'émission initiale et le dernier changement de chaque observable sont indiqués
- **AND** seuls des états, compteurs et horodatages non sensibles apparaissent

#### Scenario: Failed or pending database opening is reported

- **GIVEN** `db.open()` a échoué ou est resté en attente
- **WHEN** le rapport est produit
- **THEN** l'état correspondant est affiché sans message d'erreur brut ni stack
- **AND** les autres dimensions du diagnostic restent disponibles
- **AND** le rapport est produit même si la base n'est pas complètement ouverte

#### Scenario: OTP request lifecycle is reported without identity

- **GIVEN** une demande OTP a été lancée et a réussi, échoué ou été annulée
- **WHEN** le rapport est produit
- **THEN** le lancement et l'issue sont décrits par un état normalisé
- **AND** aucun email, code, jeton ni identifiant de compte n'est inclus
- **AND** aucune nouvelle demande OTP n'est déclenchée par la production du rapport

#### Scenario: Missing chronology stays unavailable

- **GIVEN** l'instrumentation n'a conservé aucune mesure
- **WHEN** le rapport décrit le cycle d'initialisation
- **THEN** chaque mesure absente vaut `non disponible`
- **AND** aucune chronologie n'est inventée à partir de l'heure courante
- **AND** l'absence de chronologie n'empêche ni la copie ni le diagnostic existant

#### Scenario: Instrumentation cannot alter bootstrap behavior

- **GIVEN** l'instrumentation est active
- **WHEN** la base s'ouvre, les observables émettent ou une demande OTP est lancée
- **THEN** aucun enregistrement ne bloque, ne retarde ou ne rejette le parcours
- **AND** aucun appel réseau, ouverture, authentification ou pull supplémentaire n'est provoqué
- **AND** aucune trace brute ni valeur d'identité n'est conservée

### Requirement: Source-level allowlist

Le rapport SHALL appliquer une liste blanche de champs et de valeurs à sa
source, et non une substitution du texte final. Il MUST exclure les données
métier, emails, OTP, jetons, cookies, codes, identifiants de compte, stacks,
messages bruts, URLs sensibles, contenus de stockage et identifiants de suivi.

#### Scenario: Trapped sensitive values never reach the report

- **GIVEN** les signaux contiennent des emails, OTP, jetons, cookies, identifiants de compte, titres, notes, URLs avec credentials/query/hash ou messages bruts
- **WHEN** le rapport et son aperçu sont produits
- **THEN** aucune de ces valeurs n'apparaît dans le texte
- **AND** seuls des catégories, codes, libellés et états approuvés sont présents
- **AND** aucun contenu brut IndexedDB ou localStorage n'est inclus

### Requirement: Anonymized workspace and masked Cloud origin

Les noms de bases locales et identifiants distants SHALL être anonymisés ou
remplacés par des libellés de correspondance sûrs. L'origine Cloud SHALL être
masquée par défaut et aucun identifiant de suivi MUST apparaître.

#### Scenario: Workspace identifiers are anonymized

- **GIVEN** un espace synchronisé possède un nom de base locale, un identifiant distant et une origine Cloud
- **WHEN** le rapport décrit l'espace actif
- **THEN** le nom de base et l'identifiant distant sont remplacés par des libellés de correspondance sûrs
- **AND** l'origine Cloud est masquée par défaut
- **AND** aucun identifiant permettant de suivre un utilisateur ou un espace n'est présent

### Requirement: Insufficient redaction is signalled

Quand une dimension ne peut pas être fournie sous une forme suffisamment
expurgée, le rapport SHALL l'omettre ou la marquer `non disponible` et signaler
que des informations ont été masquées, sans option de partage brut.

#### Scenario: Insufficient redaction is signalled

- **GIVEN** une dimension ne peut pas être fournie sous une forme suffisamment expurgée
- **WHEN** le rapport est produit
- **THEN** cette dimension est omise ou marquée `non disponible`
- **AND** le rapport signale que des informations ont été masquées
- **AND** aucune option cachée ne permet de partager une version brute

### Requirement: Preview matches the copied report

Un aperçu du texte SHALL être accessible avant ou après la copie et MUST
correspondre exactement au rapport destiné à la copie.

#### Scenario: Preview exposes exactly the copied text

- **GIVEN** l'utilisateur affiche l'aperçu ou copie le rapport
- **WHEN** le texte est présenté
- **THEN** l'aperçu correspond exactement au texte destiné à la copie
- **AND** il est sélectionnable et lisible sans interprétation HTML
- **AND** l'utilisateur peut le consulter avant ou après la copie

### Requirement: Clipboard success, fallback and truthful feedback

Lors d'une action utilisateur en contexte sécurisé, la copie SHALL utiliser
`navigator.clipboard.writeText`. Le succès SHALL être confirmé de façon
accessible. Si l'API est absente ou la copie refusée, le rapport intégral SHALL
rester dans un champ sélectionnable avec une consigne de copie manuelle, sans
prétendre que la copie a réussi.

#### Scenario: Successful clipboard write is confirmed

- **GIVEN** le contexte est sécurisé et l'API de presse-papiers écrit le texte
- **WHEN** l'utilisateur active « Copier le diagnostic pour assistance »
- **THEN** le rapport est écrit dans le presse-papiers
- **AND** une confirmation accessible annonce la réussite
- **AND** l'utilisateur reste sur la page de synchronisation

#### Scenario: Missing clipboard API falls back to manual copy

- **GIVEN** `navigator.clipboard.writeText` est absent
- **WHEN** l'utilisateur active la copie
- **THEN** le rapport intégral reste visible dans un champ sélectionnable
- **AND** un message accessible explique comment le copier manuellement
- **AND** aucun message de réussite automatique n'est affiché

#### Scenario: Refused clipboard write preserves the full report

- **GIVEN** l'API existe mais la promesse d'écriture est rejetée
- **WHEN** l'utilisateur active la copie
- **THEN** le rapport intégral reste sélectionnable dans l'aperçu
- **AND** un message accessible explique la copie manuelle
- **AND** l'interface ne prétend pas que le presse-papiers contient le rapport

### Requirement: Accessible, continuous and side-effect-free sharing

La zone de partage SHALL rester utilisable sur petit écran Android en portrait
et paysage, au toucher et au clavier, avec un nom accessible, un statut
`role="status"`, un focus conservé et sans saut de scroll au clic. Elle MUST NOT
déclencher reconnexion, OTP, migration, pull, purge, récupération isolée,
écriture, stockage, télémétrie ou envoi automatique à une IA.

#### Scenario: Keyboard and touch operation

- **GIVEN** la page de synchronisation est affichée sur mobile ou au clavier
- **WHEN** l'utilisateur focalise puis active le bouton de copie ou l'aperçu
- **THEN** le contrôle possède un nom accessible et une cible tactile d'au moins 44 px
- **AND** il reste opérable par Entrée ou Espace et au toucher
- **AND** le statut de copie est annoncé via `role="status"`

#### Scenario: Focus and scroll are preserved on click

- **GIVEN** l'utilisateur a défilé jusqu'à la section de diagnostic
- **WHEN** il active l'aperçu ou la copie
- **THEN** le focus reste sur un contrôle réellement présent et cohérent
- **AND** la page ne revient pas arbitrairement en haut
- **AND** aucun saut de scroll n'est provoqué par l'action

#### Scenario: Background refresh preserves sharing state

- **GIVEN** l'aperçu est ouvert ou le focus est dans la zone de partage
- **WHEN** un signal natif rafraîchit le diagnostic
- **THEN** l'état d'aperçu encore valide et le focus sont conservés
- **AND** aucun rapport périmé n'est présenté comme courant
- **AND** aucune navigation ni action Cloud n'est déclenchée par le rafraîchissement

#### Scenario: Sharing has no Cloud or data side effect

- **GIVEN** l'utilisateur consulte, affiche ou copie le rapport
- **WHEN** le rapport est construit et copié
- **THEN** aucune reconnexion, OTP, migration, pull, purge ou récupération isolée n'est lancée
- **AND** aucune donnée métier, configuration ou consentement n'est modifié
- **AND** le rapport n'est écrit ni dans IndexedDB, ni dans localStorage, ni dans un journal distant
- **AND** il n'est envoyé à aucun fournisseur IA ni service externe
