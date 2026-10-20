# cloud-settings-hub Specification

## Purpose

Réunir la configuration, l'onboarding, la connexion et les comptes Dexie Cloud
sur une page de paramètres unique, avec une continuité d'état entre les routes
et sans affaiblir les protections de consentement, d'isolation et de purge.

## Requirements

### Requirement: Single Cloud settings destination

L'application SHALL réunir sur `#/parametres/synchronisation` la configuration,
l'activation, la connexion, la gestion des espaces et le diagnostic. Chaque
contrôle existant MUST y apparaître une seule fois avec son identifiant et son
handler d'origine. Le résumé de localisation et de synchronisation SHALL rester
visible sans déplier le diagnostic technique.

#### Scenario: Every existing control appears once

- **GIVEN** l'application est chargée et la page `#/parametres/synchronisation` est affichée
- **THEN** `#cloud-config`, `#cloud-activation`, `#auth-panel` et `#workspace-panel` sont présents une seule fois
- **AND** ils sont contenus dans les sections « Configuration », « Première activation », « Connexion » et « Espaces de travail »
- **AND** `#sync-diagnostic` reste présent une seule fois sur la même page
- **AND** aucun de ces identifiants n'est dupliqué ailleurs dans le document

#### Scenario: Opening the page has no side effect

- **WHEN** l'utilisateur ouvre ou quitte `#/parametres/synchronisation`
- **THEN** aucune ouverture, réinitialisation ou reconfiguration de base n'est effectuée
- **AND** aucun OTP n'est demandé, aucune connexion ni sélection d'espace n'est lancée
- **AND** aucun transfert, consentement, pull, import, export ou purge n'est exécuté
- **AND** aucune requête réseau n'est déclenchée par la seule navigation

#### Scenario: Fresh local profile stays usable

- **GIVEN** un profil navigateur vierge sans URL Cloud configurée
- **WHEN** l'application démarre
- **THEN** Mes projets est affiché et utilisable sans OTP ni requête Cloud
- **AND** l'utilisateur peut ensuite ouvrir `#/parametres/synchronisation`
- **AND** la configuration HTTPS et l'onboarding y sont accessibles

### Requirement: Three-question page structure

La page SHALL organiser ses contenus en trois questions successives : « Où sont
mes données ? », « Sont-elles synchronisées ? » et « Que puis-je faire
maintenant ? ». Les panneaux métier SHALL rester accessibles dans des sections
repliables, sans duplication de contrôle ni opération déclenchée par la
navigation.

#### Scenario: Three questions lead the page

- **WHEN** l'utilisateur ouvre `#/parametres/synchronisation`
- **THEN** les trois questions « Où sont mes données ? », « Sont-elles synchronisées ? » et « Que puis-je faire maintenant ? » structurent la page dans cet ordre
- **AND** le mode actif, le nom de la base locale et la destination Cloud éventuelle sont visibles avant tout diagnostic technique déplié
- **AND** les panneaux métier et le diagnostic technique restent accessibles sans duplication de contrôle

### Requirement: Contextual onboarding sequence

L'application SHALL présenter l'étape d'onboarding la plus avancée réellement
attestée et l'action suivante autorisée : local autonome, configuration HTTPS,
activation opt-in, OTP natif, premier pull, revue de plan, consentement,
transfert et erreur récupérable. Elle MUST NOT annoncer une étape non atteinte.

#### Scenario: Local autonomous start

- **GIVEN** aucune URL Cloud valide n'est enregistrée
- **WHEN** l'onboarding est affiché
- **THEN** l'étape courante est le mode local autonome
- **AND** l'action suivante proposée est la configuration d'une URL HTTPS
- **AND** aucune réplication, authentification ou requête Cloud n'est tentée
- **AND** les données locales restent lisibles et exportables

#### Scenario: URL validation and reload persistence

- **WHEN** l'utilisateur soumet une URL non HTTPS, malformée ou contenant des identifiants
- **THEN** l'URL est refusée avec un message compréhensible
- **AND** aucune configuration n'est enregistrée et aucun espace n'est créé ou modifié
- **WHEN** une URL HTTPS valide est enregistrée puis la page est rechargée
- **THEN** la même URL est réutilisée sans nouvelle saisie
- **AND** aucune donnée locale n'est copiée vers l'espace synchronisé par cette configuration seule

#### Scenario: OTP then first pull before review

- **GIVEN** une URL valide est configurée et l'activation a démarré
- **WHEN** la session n'est pas authentifiée
- **THEN** l'étape affichée invite à la connexion OTP native
- **WHEN** l'utilisateur s'authentifie
- **THEN** l'étape de première lecture distante est affichée sans encore présenter de transfert
- **AND** la revue de plan n'apparaît qu'après une lecture distante attestée
- **AND** un état non attesté, hors ligne ou en erreur reste indéterminé et ne devient pas une cible vide

#### Scenario: Plan, consent and transfer are distinct

- **GIVEN** un plan de rapprochement est affiché avec sa destination et ses compteurs
- **WHEN** l'utilisateur n'a pas coché le consentement propre à ce plan
- **THEN** aucun enregistrement n'est copié vers l'espace synchronisé
- **AND** l'action de confirmation reste désactivée
- **WHEN** le plan, l'URL, le compte, la base distante ou les opérations changent
- **THEN** le consentement affiché devient caduc et une nouvelle revue est requise
- **AND** aucune écriture n'est effectuée avec l'ancien consentement

#### Scenario: Divergence and error stay recoverable

- **GIVEN** la cible est peuplée, divergente, indisponible ou liée à un autre compte
- **WHEN** l'onboarding évalue la cible
- **THEN** il affiche une catégorie compréhensible et la prochaine action autorisée
- **AND** il ne transmet aucune donnée locale à cette cible
- **AND** une erreur réseau ou une interruption laisse la source locale et la destination récupérables
- **AND** aucun succès distant ni base vide n'est affirmé

### Requirement: Navigation preserves in-progress Cloud journeys

Un changement de route MUST NOT réinitialiser, annuler ou soumettre un OTP en
cours, une erreur, un plan d'activation ou un consentement affiché. Revenir à la
page SHALL restaurer l'état courant sans écriture ni transmission.

#### Scenario: OTP pending during navigation

- **GIVEN** un OTP a été demandé et le formulaire est en phase de saisie du code
- **WHEN** l'utilisateur navigue vers Mes projets puis revient à `#/parametres/synchronisation`
- **THEN** le formulaire est toujours en phase de saisie du code
- **AND** le statut et l'éventuelle erreur OTP sont conservés
- **AND** aucun nouveau code n'est demandé et aucun OTP n'est soumis ou annulé par la navigation
- **AND** Dexie Cloud reste la seule autorité sur la validité et l'expiration du code

#### Scenario: Activation review survives navigation

- **GIVEN** une revue d'activation affiche un plan et son consentement n'est pas encore donné
- **WHEN** l'utilisateur quitte la page puis y revient
- **THEN** le même plan et la même destination restent affichés
- **AND** la confirmation reste désactivée jusqu'à une nouvelle action explicite de consentement
- **AND** aucune insertion, suppression ou validation silencieuse n'a eu lieu pendant la navigation

#### Scenario: Leaving the page during a pending journey

- **GIVEN** une activation, une connexion ou un transfert est en attente ou en erreur
- **WHEN** l'utilisateur ouvre une autre page
- **THEN** aucune transmission, suppression ou validation implicite n'est déclenchée
- **AND** l'espace local et la destination restent inchangés
- **AND** les états nécessaires restent disponibles au retour

#### Scenario: Reload rebuilds instead of restoring stale consent

- **WHEN** la page est rechargée pendant ou après une activation
- **THEN** l'onboarding et le diagnostic sont reconstruits depuis les signaux natifs et les données courantes
- **AND** aucun consentement, message de succès ou formulaire OTP antérieur n'est restauré comme s'il était encore valide
- **AND** la source locale et la destination restent récupérables

### Requirement: Contextual access from the projects overview

La vue Mes projets SHALL proposer un lien non destructif vers
`#/parametres/synchronisation` lorsqu'un état Cloud configuré ou une session
nécessite une action. Le résumé de synchronisation MUST rester non interactif et
aucune action Cloud ne MUST être déclenchée par son affichage.

#### Scenario: Action required exposes a settings link

- **GIVEN** un espace Cloud configuré présente une session absente ou expirée, une erreur, un pull initial en attente ou en échec, une écriture locale en attente ou un espace bloqué
- **WHEN** Mes projets est affiché
- **THEN** un lien libellé en français vers `#/parametres/synchronisation` est visible
- **AND** il est atteignable au clavier et au toucher
- **AND** son activation ouvre la page de synchronisation sans lancer d'OTP, de pull, de transfert ou de purge

#### Scenario: Healthy local overview has no Cloud link

- **GIVEN** aucun espace Cloud n'est configuré et aucune erreur locale n'existe
- **WHEN** Mes projets est affiché
- **THEN** le résumé d'attention et le lien Cloud sont masqués
- **AND** la page de synchronisation reste accessible depuis le menu
- **AND** aucune ouverture d'instance Cloud n'est effectuée pour produire cet affichage

#### Scenario: Summary stays non-interactive

- **WHEN** le résumé d'attention de Mes projets est visible
- **THEN** il reste une zone de statut non interactive sans bouton de relance
- **AND** il ne contient aucun secret, OTP, token ni contenu métier
- **AND** le lien d'accès est un élément distinct qui ne propose aucune relance ni mutation

### Requirement: Local data and degraded states survive navigation

Un diagnostic Cloud vide, non vérifié ou en erreur MUST NOT faire disparaître les
tâches locales ni conclure à une base distante vide. Les erreurs réseau et les
états dégradés SHALL rester consultables après navigation.

#### Scenario: Unverified diagnostic does not hide local tasks

- **GIVEN** un espace local contient des sujets et des tâches
- **AND** le diagnostic Cloud est vide, non vérifié ou en erreur
- **WHEN** l'utilisateur navigue entre Mes projets et les paramètres
- **THEN** les tâches locales restent affichées ou récupérables sans écriture
- **AND** l'absence de preuve distante reste explicitement indéterminée
- **AND** aucune suppression, migration ou réinitialisation n'est déclenchée

#### Scenario: Network and degraded states remain accessible

- **GIVEN** une erreur réseau, une déconnexion native ou un état de lecture dégradé
- **WHEN** Mes projets ou la page de synchronisation est affichée
- **THEN** la catégorie d'erreur et la raison restent visibles et annoncées
- **AND** aucune relance de pull n'est déclenchée automatiquement
- **AND** aucune donnée métier ni secret n'est exposé

### Requirement: Distinct account, suspension, logout and purge actions

Se déconnecter, suspendre Cloud, changer d'espace et purger la copie locale
SHALL rester des actions distinctes, nommées et confirmées, avec le nom de la
base et la portée concernée. Aucune navigation MUST produire une action
destructive implicite.

#### Scenario: Four actions remain separate and scoped

- **GIVEN** l'espace de travail est affiché sur la page de synchronisation
- **WHEN** l'utilisateur consulte les actions disponibles
- **THEN** « Changer d'espace », « Suspendre Cloud », « Se déconnecter » et « Purger la copie locale » sont présentés séparément
- **AND** la portée indique l'URL et le nom effectif de la base locale concernée
- **AND** aucune action n'est présélectionnée ni déclenchée par l'ouverture de la page

#### Scenario: Destructive actions keep confirmations and backup

- **GIVEN** un espace contient des changements non attestés comme transmis
- **WHEN** l'utilisateur demande une déconnexion ou une purge
- **THEN** l'application avertit du risque avant tout changement de session ou de base
- **AND** elle propose une sauvegarde JSON, une annulation et une confirmation explicite
- **WHEN** l'utilisateur annule
- **THEN** la session, la base locale, la destination et les autres espaces restent inchangés

#### Scenario: Purge and suspension never touch remote data

- **GIVEN** un espace synchronisé identifié par son URL et son nom de base
- **WHEN** l'utilisateur confirme une purge locale ou suspend Cloud
- **THEN** seule la base locale identifiée peut être supprimée ou mise hors service
- **AND** aucune suppression d'enregistrement métier distant n'est émise
- **AND** les autres bases, l'espace autonome et la configuration restent intacts

#### Scenario: Workspace transitions preserve data and diagnostics

- **GIVEN** les espaces A et B sont enregistrés avec des données distinctes
- **WHEN** l'utilisateur sélectionne A, puis B, puis A
- **THEN** chaque espace retrouve sa propre base locale et ses données
- **AND** aucune donnée n'est copiée ou fusionnée entre A et B
- **AND** le diagnostic affiche à chaque fois le type, la base et l'URL courants
- **AND** aucune base non sélectionnée n'est réinitialisée ou supprimée

### Requirement: Presentation-only route changes

Les changements de route SHALL uniquement modifier la présentation. Ils MUST NOT
ouvrir, réinitialiser, reconnecter ou reconfigurer une base, ni dupliquer les
opérations des modules existants.

#### Scenario: Route changes preserve Dexie context

- **GIVEN** une synchronisation et des valeurs diagnostiques sont affichées
- **WHEN** l'utilisateur ouvre la page de synchronisation, revient à Mes projets puis utilise Précédent ou Suivant
- **THEN** le même contexte Dexie et les mêmes valeurs diagnostiques restent en mémoire
- **AND** aucune base n'est recréée, réinitialisée ou rouverte
- **AND** aucun abonnement natif n'est ajouté par la seule navigation

#### Scenario: Existing modules and handlers are reused

- **WHEN** un contrôle de configuration, d'activation, de connexion, d'espace ou de purge est exercé depuis la page de synchronisation
- **THEN** il utilise le module et le handler existants
- **AND** aucun second état métier ni second formulaire n'est créé
- **AND** `requireAuth`, les validations Dexie, l'isolation et les confirmations restent appliqués

### Requirement: Collapsible business panels preserve existing handlers

Les sections « Configuration », « Première activation », « Connexion » et
« Espaces de travail » SHALL être repliables au clavier et au toucher. Leur
ouverture ou fermeture MUST rester une opération de présentation : elle MUST NOT
ouvrir, reconnecter, soumettre, transférer, sélectionner, suspendre, déconnecter
ou purger quoi que ce soit. Chaque panneau MUST conserver le contrôle et le
handler existants, et une seule source de vérité pour son état en cours.

#### Scenario: Collapsing a panel changes only the presentation

- **GIVEN** une section métier est ouverte et contient un formulaire ou une erreur en cours
- **WHEN** l'utilisateur la replie puis la déplie
- **THEN** le formulaire, le statut et l'erreur sont conservés
- **AND** aucune requête, écriture, soumission ou sélection n'est déclenchée
- **AND** le focus reste utilisable au clavier

#### Scenario: Collapsed panels remain reachable

- **GIVEN** les sections métier sont repliées
- **WHEN** l'utilisateur parcourt la page au clavier ou au toucher
- **THEN** chaque section possède un titre et un contrôle d'ouverture accessibles
- **AND** les contrôles restent atteignables une seule fois après dépliage
- **AND** le diagnostic technique n'est pas dupliqué hors de sa section

### Requirement: Technical information stays secondary

Les identifiants techniques supplémentaires, les détails de bootstrap et les
messages classés SHALL être regroupés sous une rubrique « Informations
techniques » repliable, distincte du résumé de confiance. Leur lecture MUST NOT
être nécessaire pour identifier le mode, la base locale, la destination, la
session, la connexion ou la prochaine action sûre.

#### Scenario: First screen does not require the technical block

- **WHEN** la page est affichée sans déplier « Informations techniques »
- **THEN** le mode, le nom de la base locale, la destination éventuelle et l'état de synchronisation compréhensible sont visibles
- **AND** les identifiants techniques restent disponibles dans la rubrique repliée
- **AND** aucun élément métier ni secret n'est exposé dans l'un ou l'autre bloc
