# app-navigation Specification

## Purpose

Offre un menu de navigation principal et des routes de paramètres stables pour
rejoindre « Mes projets », les Imports / Exports et la Synchronisation Dexie
Cloud sans encombrer l'accueil, sans perdre la navigation des projets et sans
effet de bord sur les données ou la synchronisation.

## Requirements

### Requirement: Header navigation menu

L'application SHALL afficher dans l'en-tête un bouton natif de type `button`
nommé « Menu », avec une cible d'au moins 44 × 44 px, visible et utilisable sur
mobile comme sur ordinateur. Le bouton SHALL contrôler un panneau de navigation
contenant exactement « Mes projets », « Paramètres », « Imports / Exports » et
« Synchronisation Dexie Cloud », dans cet ordre.

#### Scenario: Menu button is present on every route

- **WHEN** l'application affiche la vue d'ensemble, un projet ou une page de paramètres
- **THEN** le bouton « Menu » reste présent dans l'en-tête
- **AND** il est utilisable sur un écran étroit comme sur un écran large

#### Scenario: Menu entries are the expected ones

- **WHEN** le panneau de navigation est ouvert
- **THEN** il montre « Mes projets », « Paramètres », « Imports / Exports » et « Synchronisation Dexie Cloud »
- **AND** aucun autre lien de navigation principal n'y est ajouté

#### Scenario: Menu entries target stable relative fragments

- **WHEN** un élément du panneau est activé
- **THEN** il cible respectivement `#/`, `#/parametres`, `#/parametres/donnees` et `#/parametres/synchronisation`
- **AND** aucun identifiant sensible, secret ou propre à un compte n'apparaît dans l'URL

### Requirement: Settings routes and project route compatibility

Les fragments `#/`, `#/parametres`, `#/parametres/donnees` et
`#/parametres/synchronisation` SHALL désigner respectivement Mes projets et les
trois pages de paramètres. La route existante `#/sujet/<id>` SHALL continuer à
afficher le projet dont l'identifiant stable est encodé dans le fragment.

#### Scenario: Direct entry to a settings route

- **WHEN** l'application est chargée directement avec `#/parametres`, `#/parametres/donnees` ou `#/parametres/synchronisation`
- **THEN** la page de paramètres correspondante est affichée
- **AND** aucun projet, import, export ou diagnostic n'est ouvert ou exécuté à cause de cette route

#### Scenario: Navigation between settings pages and projects

- **WHEN** l'utilisateur navigue du menu vers Mes projets ou vers une page de paramètres
- **THEN** la vue demandée devient active et le menu se ferme

#### Scenario: Browser history and reload

- **GIVEN** une page de paramètres ou un projet valide est affiché
- **WHEN** l'utilisateur utilise Précédent, Suivant ou recharge la page
- **THEN** la vue correspondant au fragment courant est restaurée

#### Scenario: Valid project route is unchanged

- **GIVEN** un fragment `#/sujet/<id>` dont l'identifiant existe dans le document courant
- **WHEN** la route est interprétée
- **THEN** la vue détaillée de ce projet est affichée comme avant TS-041
- **AND** les routes de paramètres n'interfèrent ni avec son identifiant ni avec son retour vers la vue d'ensemble

### Requirement: Unknown route handling

Un fragment non reconnu SHALL être traité sans exception et sans exposer un
panneau normalement masqué. L'application SHALL conserver le repli
déterministe existant vers la vue d'ensemble pour ces fragments.

#### Scenario: Unknown fragment falls back to the overview

- **WHEN** le fragment ne correspond ni à une route de paramètres ni à une route de projet valide
- **THEN** la vue d'ensemble est affichée sans erreur
- **AND** aucun panneau de restauration, de récupération ou de diagnostic masqué n'est rendu visible à cause du fragment

#### Scenario: Malformed project fragment stays accessible

- **WHEN** le fragment de projet est malformé ou ne contient pas d'identifiant valide
- **THEN** le repli accessible existant de la vue détaillée est affiché
- **AND** aucun sujet n'est créé ou modifié

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

### Requirement: Menu interaction and accessible state

Le bouton Menu SHALL exposer un `aria-expanded` exact et un `aria-controls`
pointant vers le panneau. Le panneau SHALL être masqué hors ouverture. Le menu
SHALL se fermer après navigation, par Échap et par une action extérieure
pertinente ; une fermeture sans navigation SHALL retourner le focus au bouton.

#### Scenario: Closed and open states

- **WHEN** le menu est fermé
- **THEN** le bouton expose `aria-expanded="false"` et le panneau est masqué
- **WHEN** le menu est ouvert
- **THEN** le bouton expose `aria-expanded="true"` et le panneau est visible

#### Scenario: Activating the button toggles the menu

- **WHEN** le bouton Menu est activé par clic, toucher, Entrée ou Espace
- **THEN** le menu s'ouvre s'il était fermé et se ferme s'il était ouvert
- **AND** le focus reste visible sur un contrôle utilisable

#### Scenario: Escape closes and restores focus

- **GIVEN** le menu est ouvert et le focus est dans le panneau
- **WHEN** Échap est actionné
- **THEN** le menu se ferme
- **AND** le focus revient au bouton Menu

#### Scenario: Navigation closes the menu

- **GIVEN** le menu est ouvert
- **WHEN** un de ses liens est activé
- **THEN** le menu se ferme et la route demandée devient active
- **AND** le focus est placé sur le titre de la page de destination

#### Scenario: Outside action closes the menu

- **GIVEN** le menu est ouvert
- **WHEN** l'utilisateur active un contrôle extérieur au menu
- **THEN** le menu se ferme
- **AND** l'action extérieure conserve son comportement

#### Scenario: View change closes the menu

- **GIVEN** le menu est ouvert
- **WHEN** la route change, y compris par Précédent ou Suivant
- **THEN** le menu se ferme et n'est pas restauré ouvert après le rendu

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

### Requirement: Narrow viewport and safe rendering

Le menu et les pages de paramètres SHALL rester utilisables à 320 px sans
débordement horizontal, avec des libellés français rendus comme texte et des
cibles interactives d'au moins 44 × 44 px.

#### Scenario: Menu at a narrow width

- **GIVEN** une largeur de viewport de 320 px
- **WHEN** le menu est ouvert
- **THEN** ses liens restent entièrement visibles et atteignables sans débordement horizontal
- **AND** chaque lien offre une cible d'au moins 44 × 44 px

#### Scenario: Titles and labels are text

- **WHEN** l'en-tête, le menu et les pages de paramètres sont rendus
- **THEN** leurs libellés français sont des nœuds texte
- **AND** aucune chaîne n'est interprétée comme du HTML exécutable
