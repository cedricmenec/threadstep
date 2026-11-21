# app-navigation Specification

## Purpose

Offre un menu de navigation principal et des routes de paramètres stables pour
rejoindre « Mes projets », les Imports / Exports et la Synchronisation Dexie
Cloud sans encombrer l'accueil, sans perdre la navigation des projets et sans
effet de bord sur les données ou la synchronisation.

## Requirements

### Requirement: Header navigation menu

L'application SHALL afficher un bouton natif `button` nommé « Menu » d'au moins
44 × 44 px. Sous le point de rupture local, il SHALL contrôler un panneau listant
exactement « Mes projets », « Paramètres », « Imports / Exports » et
« Synchronisation Dexie Cloud », dans cet ordre. Au-dessus, il SHALL être masqué
au profit d'une navigation latérale persistante sans doublon.

#### Scenario: Menu button is present on every route

- **WHEN** l'application affiche la vue d'ensemble, un projet ou une page de
  paramètres sur une largeur inférieure au point de rupture local
- **THEN** le bouton « Menu » reste présent dans l'en-tête
- **AND** il est utilisable sur un écran étroit

#### Scenario: Desktop rail presents the same destinations

- **GIVEN** une largeur supérieure ou égale au point de rupture local
- **WHEN** l'application affiche la vue d'ensemble, un projet ou une page de
  paramètres
- **THEN** les quatre destinations sont visibles dans une navigation latérale
  persistante
- **AND** le bouton « Menu » n'est pas présenté comme contrôle visible
- **AND** aucun lien de navigation principal n'est dupliqué dans le document

#### Scenario: Menu entries are the expected ones

- **WHEN** le panneau de navigation ou le rail latéral est affiché
- **THEN** il montre « Mes projets », « Paramètres », « Imports / Exports » et « Synchronisation Dexie Cloud »
- **AND** aucun autre lien de navigation principal n'y est ajouté

#### Scenario: Menu entries target stable relative fragments

- **WHEN** un élément du panneau ou du rail est activé
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
pointant vers le panneau. Sous le point de rupture local, le panneau SHALL être
masqué hors ouverture ; au-dessus, il SHALL rester visible comme navigation
latérale. Le menu SHALL se fermer après navigation, par Échap et par une action
extérieure ; une fermeture sans navigation SHALL rendre le focus au bouton.

#### Scenario: Closed and open states

- **GIVEN** une largeur inférieure au point de rupture local
- **WHEN** le menu est fermé
- **THEN** le bouton expose `aria-expanded="false"` et le panneau est masqué
- **WHEN** le menu est ouvert
- **THEN** le bouton expose `aria-expanded="true"` et le panneau est visible

#### Scenario: Desktop rail stays visible without open state

- **GIVEN** une largeur supérieure ou égale au point de rupture local
- **WHEN** la route est affichée puis parcourue
- **THEN** le panneau de navigation reste visible et accessible comme rail
- **AND** aucune ouverture préalable du bouton n'est requise pour l'atteindre

#### Scenario: Activating the button toggles the menu

- **WHEN** le bouton Menu est activé par clic, toucher, Entrée ou Espace
- **THEN** le menu s'ouvre s'il était fermé et se ferme s'il était ouvert
- **AND** le focus reste visible sur un contrôle utilisable

#### Scenario: Escape closes and restores focus

- **GIVEN** le tiroir est ouvert et le focus est dans le panneau
- **WHEN** Échap est actionné
- **THEN** le menu se ferme
- **AND** le focus revient au bouton Menu

#### Scenario: Navigation closes the menu

- **GIVEN** le tiroir est ouvert
- **WHEN** un de ses liens est activé
- **THEN** le menu se ferme et la route demandée devient active
- **AND** le focus est placé sur le titre de la page de destination

#### Scenario: Outside action closes the menu

- **GIVEN** le tiroir est ouvert
- **WHEN** l'utilisateur active un contrôle extérieur au menu
- **THEN** le menu se ferme
- **AND** l'action extérieure conserve son comportement

#### Scenario: View change closes the menu

- **GIVEN** le tiroir est ouvert
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

### Requirement: Bounded React shell for the header and navigation

L'en-tête et le menu principal SHALL pouvoir être rendus par une coque React de
présentation possédant exclusivement un hôte DOM dédié à l'en-tête. La coque
MUST NOT posséder ni réécrire `#subjects`, les pages de paramètres, les
formulaires OTP, Cloud, import/restauration ou consentement. Les routes, le
routeur par fragment et l'autorité de navigation restent ceux du contrôleur
existant.

#### Scenario: The shell owns only the header host

- **WHEN** la coque React est montée
- **THEN** elle possède uniquement le sous-arbre DOM de l'en-tête et de la
  navigation
- **AND** `#subjects`, les pages de paramètres et les formulaires métier
  conservent leur propriétaire vanilla
- **AND** aucune seconde copie de l'en-tête, du menu ou d'un formulaire
  métier n'est créée

#### Scenario: No second router or route source

- **WHEN** les modules de la coque et le contrôleur sont inspectés
- **THEN** ils réutilisent `parseRoute`, `hashchange`, `navigate`,
  `activateNavigationLink` et `routeHeadingId`
- **AND** aucun routeur, historique, store ou préférence de route parallèle
  n'est introduit
- **AND** les fragments existants gardent la même interprétation

#### Scenario: The shell is released at a context boundary

- **GIVEN** une coque active avec un menu éventuellement ouvert
- **WHEN** la route change, l'identité autorisée change ou l'état métier
  devient bloquant
- **THEN** l'ancienne coque est démontée ou invalidée avant le rendu suivant
- **AND** son menu n'est pas restauré ouvert
- **AND** aucun contenu métier du contexte précédent n'est affiché, copié ou
  écrit par la coque

#### Scenario: Shell lifecycle has no business side effect

- **GIVEN** une coque montée avec des espions sur IndexedDB, `localStorage`,
  `fetch`, WebSocket, l'OTP et les commandes métier
- **WHEN** la coque est montée, mise à jour, remontée et démontée
- **THEN** aucune écriture, requête réseau, authentification, migration,
  ouverture de base ou commande métier n'est observée
- **AND** aucun formulaire OTP ou Cloud n'est monté par la coque

### Requirement: Coexistence of the shell with the React project detail

La coque React et la racine React du détail projet SHALL être deux propriétaires
DOM distincts. Une mise à jour, un remontage ou un démontage de la coque MUST
NOT remonter la racine du détail, réinitialiser ses commandes, son Undo, ses
listes, son scroll, son focus ou ses brouillons encore valides.

#### Scenario: Shell updates leave the detail surface intact

- **GIVEN** le détail d'un projet est rendu par React et la coque est active
- **WHEN** le menu de la coque est ouvert puis fermé
- **THEN** la racine du détail reste la même et ne reçoit aucun démontage
- **AND** les commandes, l'Undo de dix secondes, les listes, le focus, le scroll
  et les brouillons valides du détail restent disponibles
- **AND** aucune écriture métier supplémentaire n'est émise par la coque

#### Scenario: Menu interaction does not move the reading position

- **GIVEN** une page est défilée et une vue autorisée est affichée
- **WHEN** le menu de la coque est ouvert puis fermé sans navigation
- **THEN** la position de défilement du document reste inchangée
- **AND** l'ancrage de lecture et le focus de la vue courante ne sont pas
  déplacés par la coque
- **AND** aucune donnée ni préférence n'est écrite

#### Scenario: Detail commands remain owned by the detail

- **GIVEN** la coque et le détail React sont montés ensemble
- **WHEN** une commande du détail est activée une seule fois
- **THEN** le contrôleur reçoit exactement une intention correspondante
- **AND** la coque n'ajoute ni listener ni callback à cette commande
- **AND** aucune seconde écriture n'est observée

#### Scenario: Overview and settings stay vanilla

- **WHEN** `#/`, `#/parametres`, `#/parametres/donnees` ou
  `#/parametres/synchronisation` est affiché
- **THEN** la coque reste limitée à l'en-tête et ne monte aucune surface métier
- **AND** Overview, sauvegardes, Synchronisation et leurs handlers conservent
  leur comportement existant
- **AND** les états de lecture TS-052 restent valides

### Requirement: Four-destination parity through the React shell

La coque React SHALL conserver exactement les quatre destinations existantes,
dans le même ordre, avec les mêmes libellés français et les mêmes fragments.
L'accès direct, le rechargement, la navigation par lien, Précédent, Suivant et
le repli des fragments inconnus MUST rester identiques au rendu livré.

#### Scenario: Exact destinations and fragments

- **WHEN** le panneau de navigation de la coque est rendu
- **THEN** il contient exactement « Mes projets », « Paramètres »,
  « Imports / Exports » et « Synchronisation Dexie Cloud », dans cet ordre
- **AND** leurs liens ciblent respectivement `#/`, `#/parametres`,
  `#/parametres/donnees` et `#/parametres/synchronisation`
- **AND** aucun autre lien de navigation principal n'est ajouté

#### Scenario: Direct entry, reload and history stay unchanged

- **GIVEN** l'application est chargée directement avec l'un des quatre
  fragments ou avec un `#/sujet/<id>` valide
- **WHEN** la page est rechargée puis parcourue avec Précédent et Suivant
- **THEN** la vue correspondant au fragment courant est restaurée
- **AND** aucun identifiant sensible, secret ou propre à un compte n'apparaît
  dans l'URL
- **AND** aucune route nouvelle n'est créée par la coque

#### Scenario: Link activation navigates once and focuses the destination title

- **GIVEN** le menu est ouvert
- **WHEN** un lien de destination est activé une fois
- **THEN** le menu se ferme, la route demandée devient active et le focus est
  placé sur le titre de la page de destination selon le mappage existant
- **AND** le contrôleur reçoit une seule intention de navigation
- **AND** aucun historique ou gestionnaire parallèle n'est créé

#### Scenario: Unknown and malformed fragments keep their fallback

- **WHEN** le fragment ne correspond à aucune route connue ou qu'un fragment de
  projet est malformé
- **THEN** le repli déterministe existant vers la vue d'ensemble ou le détail
  accessible est conservé
- **AND** aucun panneau masqué n'est rendu visible par la coque
- **AND** aucun sujet n'est créé ou modifié

#### Scenario: Authorized view state survives shell navigation

- **GIVEN** un OTP est en cours de saisie ou une activation Cloud affiche une
  revue sans consentement
- **WHEN** l'utilisateur navigue vers une autre destination puis revient à la
  page de synchronisation
- **THEN** le formulaire, le plan, le statut et l'erreur éventuelle restent dans
  leur état courant
- **AND** aucun OTP n'est soumis, annulé ou redemandé par la navigation
- **AND** aucun consentement, transfert ou purge n'est validé ou exécuté

### Requirement: Menu interaction parity through the React shell

Le bouton Menu de la coque SHALL rester un `button` natif nommé « Menu », avec
`aria-expanded` exact et `aria-controls` pointant vers le panneau, masqué hors
ouverture sous le point de rupture local. Au-dessus, le panneau SHALL rester
visible comme rail. Le menu MUST se fermer après navigation, par Échap ou action
extérieure ; une fermeture sans navigation restaure le focus au déclencheur.

#### Scenario: Closed and open states are exact

- **GIVEN** une largeur inférieure au point de rupture local
- **WHEN** le menu est fermé
- **THEN** le bouton expose `aria-expanded="false"` et le panneau est masqué
- **WHEN** le menu est ouvert
- **THEN** le bouton expose `aria-expanded="true"` et le panneau est visible
- **AND** `aria-controls` référence le panneau présent une seule fois

#### Scenario: Desktop rail is the same single panel

- **GIVEN** une largeur supérieure ou égale au point de rupture local
- **WHEN** la coque est rendue
- **THEN** le panneau de navigation est visible comme rail persistant
- **AND** il reste l'unique instance du panneau et des quatre liens
- **AND** le bouton masqué ne crée pas de second contrôle de navigation

#### Scenario: Activation and Escape keep usable focus

- **WHEN** le bouton Menu est activé par clic, toucher, Entrée ou Espace
- **THEN** le menu s'ouvre s'il était fermé et se ferme s'il était ouvert
- **GIVEN** le tiroir est ouvert et le focus est dans le panneau
- **WHEN** Échap est actionné
- **THEN** le menu se ferme et le focus revient au bouton Menu
- **AND** le focus reste visible sur un contrôle utilisable

#### Scenario: Outside action and view change close without stale focus

- **GIVEN** le tiroir est ouvert
- **WHEN** un contrôle extérieur au menu est activé, ou que la route change par
  lien, Précédent ou Suivant
- **THEN** le menu se ferme et n'est pas restauré ouvert après le rendu
- **AND** l'action extérieure conserve son comportement
- **AND** aucun focus ne reste sur un nœud détaché

#### Scenario: Labels remain literal and ordered text

- **WHEN** l'en-tête et le menu sont rendus
- **THEN** les libellés français sont des nœuds texte et l'ordre Tab suit
  l'ordre visuel pertinent
- **AND** une chaîne contenant du markup reste littérale
- **AND** aucun élément exécutable n'est créé à partir d'un libellé

### Requirement: Responsive shell across representative widths

La coque et le menu SHALL rester utilisables sans débordement horizontal aux
largeurs 320, 390, 430, 768 et 1280 px, avec des libellés qui reviennent à la
ligne et des cibles d'au moins 44 × 44 px. Le point de rupture local approuvé
est 1024 px ; aucune autre disposition ou point de rupture non approuvé n'est
introduit.

#### Scenario: Representative widths do not introduce overflow

- **WHEN** les règles structurelles de l'en-tête, du rail et du tiroir sont
  vérifiées pour 320, 390, 430, 768 et 1280 px
- **THEN** le tiroir est borné à la largeur disponible et les libellés peuvent
  revenir à la ligne
- **AND** aucune largeur fixe supérieure à la largeur mobile n'est imposée
- **AND** le rail desktop ne provoque pas de débordement horizontal

#### Scenario: Compact widths keep the drawer

- **GIVEN** une largeur de 768, 430, 390 ou 320 px
- **WHEN** la coque est affichée
- **THEN** le bouton Menu reste visible et ouvre un tiroir lisible
- **AND** les quatre destinations restent entièrement visibles et atteignables
  sans débordement horizontal

#### Scenario: Desktop width shows the persistent rail

- **GIVEN** une largeur de 1280 px
- **WHEN** la coque est affichée
- **THEN** les quatre destinations sont visibles dans la navigation latérale
- **AND** la zone de contenu conserve une largeur lisible sans doublon de liens

#### Scenario: Targets and text remain usable at a narrow width

- **GIVEN** une largeur de viewport de 320 px
- **WHEN** le menu est ouvert
- **THEN** ses liens restent entièrement visibles et atteignables sans
  débordement horizontal
- **AND** chaque lien et le bouton Menu offrent une cible d'au moins 44 × 44 px
- **AND** les libellés sont rendus comme texte

#### Scenario: Automated width checks are not device evidence

- **WHEN** les contrôles structurels de largeur et de cible réussissent
- **THEN** ils prouvent uniquement les règles de largeur, de retour à la ligne,
  de média query et de disposition versionnées
- **AND** ils ne sont pas présentés comme une mesure de débordement sur un
  navigateur ou un appareil réel

### Requirement: Current destination indication

La coque SHALL exposer la destination courante avec `aria-current="page"` sur
le seul lien correspondant et une distinction visuelle qui ne dépend pas de la
seule couleur. Le mapping SHALL provenir d'une fonction pure de la route :
Overview et détail projet vers « Mes projets », puis chaque section de
paramètres vers sa destination.

#### Scenario: Overview and project detail mark Mes projets

- **WHEN** la route courante est `#/`, un repli vers la vue d'ensemble ou un
  `#/sujet/<id>` valide
- **THEN** le lien « Mes projets » expose `aria-current="page"`
- **AND** aucun autre lien de navigation principal ne porte `aria-current`

#### Scenario: Settings routes mark their destination

- **WHEN** la route courante est `#/parametres`, `#/parametres/donnees` ou
  `#/parametres/synchronisation`
- **THEN** seul le lien correspondant expose `aria-current="page"`
- **AND** les autres liens restent sans `aria-current`

#### Scenario: Unknown routes do not invent an active destination

- **WHEN** le fragment est inconnu ou que la route est invalide
- **THEN** la destination de repli affichée expose seule `aria-current="page"`
- **AND** aucune destination supplémentaire, route ou libellé n'est créé

#### Scenario: Active state is visible without relying on colour alone

- **GIVEN** une destination courante
- **WHEN** le rail ou le tiroir est affiché
- **THEN** le lien courant présente une distinction de forme, de fond ou de
  bordure en plus de la couleur
- **AND** le focus visible reste assuré par le contour partagé
