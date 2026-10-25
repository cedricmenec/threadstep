# app-navigation Specification Delta

## ADDED Requirements

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
`aria-expanded` exact, `aria-controls` pointant vers le panneau et un panneau
masqué hors ouverture. Le menu MUST se fermer après navigation, par Échap et par
une action extérieure pertinente ; une fermeture sans navigation restaure le
focus au déclencheur.

#### Scenario: Closed and open states are exact

- **WHEN** le menu est fermé
- **THEN** le bouton expose `aria-expanded="false"` et le panneau est masqué
- **WHEN** le menu est ouvert
- **THEN** le bouton expose `aria-expanded="true"` et le panneau est visible
- **AND** `aria-controls` référence le panneau présent une seule fois

#### Scenario: Activation and Escape keep usable focus

- **WHEN** le bouton Menu est activé par clic, toucher, Entrée ou Espace
- **THEN** le menu s'ouvre s'il était fermé et se ferme s'il était ouvert
- **GIVEN** le menu est ouvert et le focus est dans le panneau
- **WHEN** Échap est actionné
- **THEN** le menu se ferme et le focus revient au bouton Menu
- **AND** le focus reste visible sur un contrôle utilisable

#### Scenario: Outside action and view change close without stale focus

- **GIVEN** le menu est ouvert
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
ligne et des cibles interactives d'au moins 44 × 44 px. Aucune nouvelle
disposition, sidebar ou point de rupture non approuvé n'est introduit.

#### Scenario: Representative widths do not introduce overflow

- **WHEN** les règles structurelles de l'en-tête et du menu sont vérifiées pour
  320, 390, 430, 768 et 1280 px
- **THEN** le panneau est borné à la largeur disponible et les libellés peuvent
  revenir à la ligne
- **AND** aucune largeur fixe supérieure à la largeur mobile n'est imposée
- **AND** aucune sidebar permanente ou disposition nouvelle n'est ajoutée

#### Scenario: Targets and text remain usable at a narrow width

- **GIVEN** une largeur de viewport de 320 px
- **WHEN** le menu est ouvert
- **THEN** ses liens restent entièrement visibles et atteignables sans
  débordement horizontal
- **AND** chaque lien et le bouton Menu offrent une cible d'au moins 44 × 44 px
- **AND** les libellés sont rendus comme texte

#### Scenario: Automated width checks are not device evidence

- **WHEN** les contrôles structurels de largeur et de cible réussissent
- **THEN** ils prouvent uniquement les règles de largeur, de retour à la ligne
  et de média query versionnées
- **AND** ils ne sont pas présentés comme une mesure de débordement sur un
  navigateur ou un appareil réel
