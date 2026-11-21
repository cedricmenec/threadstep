# Spec Delta

## MODIFIED Requirements

### Requirement: Header navigation menu

L'application SHALL afficher un bouton natif `button` nommé « Menu » avec une
cible d'au moins 44 × 44 px. Au-dessous du point de rupture local documenté, ce
bouton SHALL contrôler un panneau contenant exactement « Mes projets »,
« Paramètres », « Imports / Exports » et « Synchronisation Dexie Cloud », dans
cet ordre. À partir de ce point, le bouton SHALL être masqué et les quatre
destinations SHALL être présentées dans une navigation latérale persistante,
sans doublon.

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

### Requirement: Menu interaction and accessible state

Le bouton Menu SHALL exposer un `aria-expanded` exact et un `aria-controls`
pointant vers le panneau. Au-dessous du point de rupture local, le panneau
SHALL être masqué hors ouverture ; au-dessus, il SHALL rester visible comme
navigation latérale. Le menu SHALL se fermer après navigation, par Échap et par
une action extérieure pertinente ; une fermeture sans navigation SHALL
retourner le focus au bouton.

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

### Requirement: Menu interaction parity through the React shell

Le bouton Menu de la coque SHALL rester un `button` natif nommé « Menu », avec
`aria-expanded` exact, `aria-controls` pointant vers le panneau et un panneau
masqué hors ouverture en dessous du point de rupture local. Au-dessus de ce
point, le même panneau SHALL rester visible comme rail. Le menu MUST se fermer
après navigation, par Échap et par une action extérieure pertinente ; une
fermeture sans navigation restaure le focus au déclencheur.

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
ligne et des cibles interactives d'au moins 44 × 44 px. À 768 px et en dessous,
le bouton Menu SHALL ouvrir un tiroir borné ; à 1280 px, les quatre destinations
SHALL être visibles dans la navigation latérale persistante. Le point de
rupture local approuvé est 1024 px ; aucune autre disposition ou point de
rupture non approuvé n'est introduit.

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

## ADDED Requirements

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
