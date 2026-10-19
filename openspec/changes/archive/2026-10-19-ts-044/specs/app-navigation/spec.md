# Spec Delta

## MODIFIED Requirements

### Requirement: Settings page structure

Chaque page de paramètres SHALL afficher un titre explicite et un contrôle de
retour en français. La page Imports / Exports SHALL réunir les contrôles
existants d'export, d'import/fusion et de restauration dans des sections
distinctes. La page Synchronisation Dexie Cloud SHALL héberger le diagnostic,
sa synthèse et les contrôles existants de configuration, d'activation, de
connexion et de gestion des espaces dans des sections nommées.

#### Scenario: Settings index page

- **WHEN** `#/parametres` est affiché
- **THEN** la page montre le titre « Paramètres »
- **AND** elle propose des liens vers Imports / Exports et Synchronisation Dexie Cloud
- **AND** elle propose un retour vers Mes projets

#### Scenario: Imports / Exports destination page

- **WHEN** `#/parametres/donnees` est affiché
- **THEN** la page montre le titre « Imports / Exports »
- **AND** elle contient les sections « Exporter », « Importer et fusionner » et « Restaurer un état antérieur »
- **AND** elle propose un retour vers les paramètres
- **AND** les contrôles existants `#export`, `#import`, `#restore` et `#restore-panel` y sont accessibles, chacun une seule fois
- **AND** chaque contrôle reste associé à son intention de sauvegarde
- **AND** chaque contrôle est atteignable au clavier et au toucher, avec un libellé français visible

#### Scenario: The overview no longer duplicates the data actions

- **WHEN** la vue d'ensemble `#/` est affichée
- **THEN** la barre d'actions initiale d'export, d'import et de restauration n'est plus affichée sur l'accueil
- **AND** aucune copie de `#export`, `#import`, `#restore` ou `#restore-panel` n'y est rendue
- **AND** les commandes de données sont accessibles depuis `#/parametres/donnees`

#### Scenario: Synchronization destination page

- **WHEN** `#/parametres/synchronisation` est affiché
- **THEN** la page montre le titre « Synchronisation Dexie Cloud »
- **AND** elle affiche une synthèse de l'état courant
- **AND** elle héberge le diagnostic technique complet `#sync-diagnostic`, une seule fois
- **AND** elle contient les sections « Configuration », « Première activation », « Connexion » et « Espaces de travail »
- **AND** les contrôles existants `#cloud-config`, `#cloud-activation`, `#auth-panel` et `#workspace-panel` y sont accessibles, chacun une seule fois
- **AND** elle propose un retour vers les paramètres
- **AND** aucun de ces contrôles n'est dupliqué ailleurs dans le document

#### Scenario: Existing controls remain available

- **WHEN** une page de paramètres est affichée
- **THEN** les contrôles existants d'export, d'import et de restauration restent disponibles sur la page Imports / Exports
- **AND** les contrôles de configuration Cloud, d'activation, de connexion et d'espaces de travail sont disponibles sur la page Synchronisation Dexie Cloud
- **AND** le diagnostic natif reste disponible dans la même page Synchronisation Dexie Cloud
- **AND** leurs sélecteurs et handlers ne sont ni renommés, ni recréés, ni dupliqués

#### Scenario: Conditional business visibility is preserved

- **GIVEN** un espace Cloud configuré et non authentifié, ou une liaison de compte bloquée
- **WHEN** la page Imports / Exports est affichée
- **THEN** les commandes métier restent masquées selon la règle de visibilité existante
- **AND** aucune commande inopérante ou non autorisée n'est rendue
- **AND** la page ne déclenche ni authentification, ni requête réseau, ni ouverture de base

### Requirement: Presentation-only navigation

L'ouverture, la fermeture du menu et le changement de route SHALL être des
opérations de présentation. Elles MUST NOT écrire dans IndexedDB ou
`localStorage`, ouvrir ou réinitialiser une base Dexie, envoyer une requête
réseau, déclencher une authentification, lancer un pull initial ou muter le
document métier. Un changement de route MUST NOT réinitialiser un OTP en cours,
un plan d'activation, une erreur ou un consentement affiché.

#### Scenario: Menu open and close do not touch data

- **WHEN** le menu est ouvert puis fermé sans activer de commande métier
- **THEN** les données IndexedDB, la configuration Cloud, les préférences et l'export restent strictement inchangés
- **AND** aucune requête réseau ni authentification n'est déclenchée

#### Scenario: Route change preserves synchronization state

- **GIVEN** un état de synchronisation et ses valeurs diagnostiques sont affichés
- **WHEN** l'utilisateur ouvre une page de paramètres puis revient à Mes projets
- **THEN** le même contexte Dexie et les mêmes valeurs restent en mémoire
- **AND** aucune base n'est recréée, réinitialisée ou rouverte par la navigation

#### Scenario: Diagnostic route change preserves native values

- **GIVEN** un diagnostic affiché avec une session, une connexion, un pull initial, des écritures locales et une erreur
- **WHEN** l'utilisateur ouvre `#/parametres/synchronisation`, revient à Mes projets puis utilise Précédent ou Suivant
- **THEN** la page et le résumé conservent les mêmes valeurs diagnostiques issues des mêmes signaux natifs
- **AND** aucun abonnement natif n'est ajouté ou recréé par la navigation
- **AND** aucune relance de pull, ouverture de base, authentification, requête réseau ou écriture n'est déclenchée

#### Scenario: Route change preserves an in-progress Cloud journey

- **GIVEN** un OTP est en cours de saisie ou une activation affiche une revue sans consentement
- **WHEN** l'utilisateur navigue vers une autre page puis revient à `#/parametres/synchronisation`
- **THEN** le formulaire, le plan, le statut et l'erreur éventuelle restent dans leur état courant
- **AND** aucun OTP n'est soumis, annulé ou redemandé par la navigation
- **AND** aucun transfert, consentement ou purge n'est validé ou exécuté

#### Scenario: No implicit business action

- **WHEN** une page de paramètres est affichée ou quittée
- **THEN** aucun import, export, restauration, réparation, purge, connexion ou transfert Cloud n'est exécuté
- **AND** aucune confirmation ou consentement en attente n'est validé automatiquement
