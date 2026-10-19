# Design

## Context

Voir `proposal.md` — Why. Le runtime est une application statique sans framework
(`site/`). `site/core.js` contient déjà les fonctions pures de routage
`subjectRoute`, `parseRoute`, `findSubject` et `isViewEntry`. `site/app.js`
interprète `location.hash` au chargement, rend la vue d'ensemble ou le détail
d'un projet dans `#subjects`, et gère les panneaux métier, Cloud,
d'authentification et de diagnostic à partir d'états conservés en mémoire.

Les contraintes structurantes sont :

- `#/sujet/<id>`, l'historique, le rechargement et le repli accessible existants
  doivent rester strictement équivalents.
- Les contrôles `#export`, `#import`, `#restore`, `#restore-panel`,
  `#sync-diagnostic`, `#cloud-config`, `#auth-panel`, `#workspace-panel` et
  leurs handlers ne doivent pas être déplacés, renommés ou dupliqués avant
  TS-042/TS-043.
- Le runner n'a ni DOM réel, ni IndexedDB, ni réseau. Les preuves automatiques
  doivent rester des fonctions pures et des assertions statiques sur les
  sources, sans ajouter de bibliothèque de navigateur.

## Goals / Non-Goals

**Goals:**

- Un menu de navigation principal accessible et une structure de pages de
  paramètres qui n'altèrent ni les données ni la synchronisation.
- Trois routes de paramètres stables, testables sans navigateur, compatibles
  GitHub Pages.
- Des preuves déterministes pour les routes, les libellés, les états du menu,
  les cibles de focus et la préservation des sélecteurs existants.

**Non-Goals:**

- Extraire, déplacer ou activer les formulaires métier de TS-042/TS-043.
- Créer un routeur, un serveur ou un rendu par composants.
- Gérer un diagnostic Cloud enrichi, un détail de configuration ou une
  activation depuis les pages de paramètres.
- Modifier les règles de persistance, de consentement, de sécurité ou de
  synchronisation.

## Decisions

### 1. Étendre les routes pures existantes plutôt qu'introduire un routeur

`parseRoute` reconnaît exactement trois fragments de paramètres et renvoie
`{ view: "settings", section: "root" | "data" | "sync" }`. Les routes de projet
et leurs validations restent inchangées. Un fragment inconnu conserve le repli
existant vers `{ view: "overview" }`.

`isViewEntry` compare aussi `section` pour les vues de paramètres, afin qu'un
changement de page de paramètres soit reconnu comme une entrée de vue, comme
l'est déjà un changement de projet.

Des fonctions pures supplémentaires exposent les entrées du menu, leur ordre et
les cibles de focus par route. Elles permettent de tester les libellés, les
fragments et le comportement du menu sans DOM.

Alternative rejetée : un routeur tiers. Il ajouterait une dépendance, un modèle
de rendu et des subtilités de base URL pour un besoin limité à quatre routes.

### 2. Un panneau de navigation statique en HTML, piloté par un état pur

Le bouton Menu et le panneau sont ajoutés dans l'en-tête HTML existant. Le
bouton est un `button type="button"` nommé « Menu », avec `aria-expanded` et
`aria-controls`. Le panneau est une région de navigation avec des liens `<a>`
vers les fragments. Il est masqué par l'attribut `hidden` hors ouverture.

L'état ouvert/fermé et la décision de restaurer le focus sont calculés par une
fonction pure partagée, testée pour les actions `toggle`, `escape`, `outside`,
`navigate` et `route-change`. `site/app.js` applique ensuite cet état au DOM.

Avantages : aucune chaîne utilisateur n'est injectée, les liens natifs
préservent l'historique et les liens profonds, et l'accessibilité de base
(`button`, `nav`, `hidden`, `aria-*`) est lisible directement dans le markup.

Alternative rejetée : générer le panneau entièrement en JavaScript. Cela
compliquerait les assertions statiques et n'apporterait aucun comportement
supplémentaire.

### 3. Pages de paramètres statiques et visibilité par route

Trois sections HTML distinctes représentent `#/parametres`,
`#/parametres/donnees` et `#/parametres/synchronisation`. Chacune possède un
titre `h2` avec `tabindex="-1"`, un texte descriptif et un lien de retour
explicite. Les pages de destination contiennent des sections descriptives
seulement : aucun formulaire, aucun handler métier et aucun identifiant DOM
existant n'est déplacé.

Une fonction de visibilité dédiée affiche la section correspondant à la route
et masque le tableau de bord « Mes projets ». Les panneaux globaux existants
(barre d'actions, espaces de travail, connexion, configuration, diagnostic)
conservent leurs règles de visibilité actuelles et restent à leur emplacement.

Alternative rejetée : réutiliser `renderDetail` pour les paramètres. Il est
spécifique aux projets, à leurs tâches et à leur fallback, et forcerait une
fausse abstraction métier.

### 4. Séparer le rendu de route du chargement des données

Le gestionnaire `hashchange` ne fait que : parser la nouvelle route, fermer le
menu, réinitialiser l'état de présentation des sous-tâches si la vue change,
mettre à jour la visibilité des pages et rendre la présentation. Il ne doit
appeler ni `load`, ni `persist`, ni `refreshSyncedDocument`, ni une ouverture de
base, ni un contrôle d'authentification.

`render()` continue de rendre la vue d'ensemble ou le détail d'un projet. Pour
une route de paramètres, il vide la zone des sujets et applique la visibilité
de route sans construire de détail de projet. Si l'accès métier n'est pas
autorisé, la page de paramètres et les panneaux existants restent rendus selon
leurs règles propres, sans charger de données métier.

Alternative rejetée : recharger le document à chaque route pour garantir la
fraîcheur. C'est inutile pour une opération de présentation et contredirait
l'exigence de conserver l'état de synchronisation en mémoire.

### 5. Focus prévisible sans dépendre d'un navigateur de test

Le bouton Menu garde le focus à l'ouverture. Échap ferme le panneau et replace
le focus sur le bouton. Un clic extérieur ferme sans voler le focus. Un lien de
navigation ferme le menu et, après le `hashchange`, place le focus sur le titre
de la page de destination ; si la destination est déjà active, le focus est
placé immédiatement. Les titres de destination sont rendus focusables par
`tabindex="-1"`.

La correspondance route → identifiant de titre est une fonction pure testée.
Le rendu réel du focus et la navigation clavier restent des vérifications
humaines explicites hors checklist.

### 6. Tests déterministes et assertions statiques

Les tests couvrent :

- les routes de paramètres, les routes de projet et le repli des routes
  inconnues ;
- `isViewEntry` entre vues de paramètres et projets ;
- l'ordre et les libellés exacts du menu ;
- la machine d'état du menu et la décision de retour du focus ;
- la correspondance route → titre focusable ;
- la présence des `aria-*`, des titres, des retours et des sections
  descriptives dans le HTML ;
- l'unicité des identifiants métier existants et leur absence dans les pages
  de paramètres ;
- l'absence d'appels de persistance, de réseau ou d'ouverture Dexie dans les
  fonctions de navigation.

Alternative rejetée : ajouter Playwright ou jsdom. Le runner resterait sans
IndexedDB, réseau, lecteur d'écran ni appareil réel, pour un coût de dépendance
et de stabilité supérieur.

## Risks / Trade-offs

- [Le menu recouvre du contenu à l'ouverture] → Panneau positionné sous le
  bouton, largeur bornée à la viewport et fermeture par action extérieure.
- [Une route de paramètres affiche encore la barre d'actions métier] → C'est
  volontaire pour ne pas déplacer les contrôles avant TS-042 ; leur
  emplacement et leurs handlers restent inchangés.
- [Le repli des routes inconnues masque une faute de frappe] → Comportement
  existant conservé et documenté ; une page « 404 » dédiée est hors périmètre.
- [Le focus est perdu en fermant le menu après un clic de lien] → Le lien de
  navigation programme le focus sur le titre de destination après le rendu.
- [Des assertions statiques deviennent fragiles] → Les tests ciblent des
  identifiants, attributs et chaînes publiques stables plutôt que des détails
  d'implémentation ligne à ligne.
- [Les tests Node donnent une fausse impression d'acceptation mobile] → Les
  recettes réelles restent explicites dans `Manual acceptance`, sans case.

## Migration Plan

Aucune migration de données. Le changement est additif et purement
présentationnel. Un retour arrière consiste à retirer le menu, les sections de
paramètres et les fonctions de routage ajoutées ; aucune donnée, clé de
stockage, configuration Cloud ou archive n'est modifiée.

## Open Questions

Aucune question ouverte ne change les spécifications, l'approche ou le découpage
des tâches. La formulation française exacte des textes descriptifs peut être
ajustée pendant l'implémentation sans modifier le comportement.
