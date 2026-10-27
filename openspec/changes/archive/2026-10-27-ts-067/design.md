# Design

## Context

Voir `proposal.md` — Why. L'état de départ est celui livré par TS-063 à
TS-066 :

- `site/app-shell/AppShell.jsx` rend `.header-nav`, `AppHeader` expose
  `#nav-menu-button` et `#nav-menu-panel`, et `AppNavigation` rend une seule
  fois les quatre entrées de `NAV_MENU_ENTRIES`.
- `#app-shell-root` est aujourd'hui imbriqué dans `.hero` de
  `site/index.html` ; `site/app.js` monte la surface dedans via
  `reconcileAppShell` et reste l'unique autorité de route (`parseRoute`,
  `hashchange`, `navigate`, `activateNavigationLink`, `routeHeadingId`,
  `navigationMenuState`).
- `#nav-menu-panel` est masqué par l'attribut `hidden` et positionné en
  panneau absolu sous le bouton. Aucun `aria-current` n'est exposé.
- `.shell` est une colonne de largeur maximale `--content-max-width: 1000px`.
  Le point de rupture compact existant est `620px` ; les cibles tactiles sont
  `44px` et le focus utilise `--focus-outline`.
- Overview est possédé par TS-066 (`site/index.html`, `site/styles.css`,
  `site/overview/`) et le détail projet par sa propre racine React. La coque ne
  doit posséder que l'en-tête et la navigation.

Contrainte structurante : le changement est **de présentation et de
navigation**. Les quatre destinations, les routes, les handlers et les données
restent ceux du contrôleur existant.

## Goals / Non-Goals

**Goals :**

- Présenter une navigation latérale persistante à partir de 1024 px et un
  tiroir compact en dessous, avec une seule instance des quatre liens.
- Garder le conteneur Overview lisible dans la colonne de contenu du shell,
  sans modifier ses cartes, commandes ou états.
- Exposer la destination courante avec `aria-current` et un style dérivé des
  tokens existants.
- Prouver par des tests déterministes la parité des destinations, les états
  structurels responsive, les attributs accessibles, l'absence d'effet métier
  et la conservation des tokens.

**Non-Goals :**

- Ajouter ou renommer une destination, une route, un routeur, un store ou une
  préférence de route.
- Modifier les valeurs de `site/styles/tokens.css`, la palette, les polices ou
  les icônes.
- Refondre Overview, le détail projet, les paramètres ou les formulaires.
- Remplacer un test structurel par une preuve de navigateur, de toucher, de
  clavier ou de lecteur d'écran réels.

## Decisions

### 1. Un seul hôte de coque, déplacé comme enfant direct de `.shell`

`#app-shell-root` reste l'unique hôte possédé par la coque React, mais devient
un enfant direct de `<main class="shell">`, placé avant `.hero`. Le rail desktop
peut alors être une colonne de la grille du shell, tandis que le contenu métier
reste dans la colonne de contenu. Aucune surface métier n'entre dans l'hôte.

Pourquoi : l'imbrication actuelle dans `.hero` empêche une colonne latérale qui
accompagne réellement Overview et les pages de paramètres. Le déplacement ne
change ni l'identifiant de l'hôte, ni le propriétaire DOM, ni le routeur.

Alternatives rejetées : dupliquer une seconde navigation desktop et garder le
menu mobile (duplique les liens et les états) ; utiliser `display:contents` sur
`.hero` (fragilise les styles d'en-tête et l'ordre de lecture) ; overlay
`position:fixed` sans vraie colonne (ne répond pas à la disposition desktop
approuvée). Le markup statique de repli de `site/index.html` est ajusté en
conséquence avec la même structure et les mêmes liens.

### 2. Point de rupture local documenté à 1024 px

Un `@media (min-width:1024px)` active le rail persistant ; en dessous, le
bouton « Menu » et le tiroir restent l'unique accès. Les largeurs imposées par
la fiche — tiroir à 768, 430, 390 et 320 px, rail à 1280 px — sont donc
couvertes. Le point de rupture est écrit littéralement, comme le `620px`
existant, car une custom property ne peut pas être consommée de façon fiable
dans une condition de média query. Il est documenté dans la décision
d'architecture et la spécification, sans nouveau token.

Pourquoi : à 768 px, une colonne latérale réduirait trop la zone Overview ;
1024 px laisse une largeur utile confortable tout en respectant les bornes
exigées. Le palier `620px` reste utilisé pour la densité compacte.

Alternatives rejetées : rail dès 768 px (contredit la fiche pour 768 px) ;
rail seulement à 1280 px (laisse 1024–1279 px sans disposition cohérente) ;
point de rupture supplémentaire multiple (complexité non demandée).

### 3. Grille du shell et largeur de contenu préservée

À partir de 1024 px, `.shell` devient une grille à deux colonnes :
`#app-shell-root` en colonne 1, les enfants de contenu en colonne 2 via
`.shell > *:not(#app-shell-root) { grid-column: 2 }`. La largeur maximale du
shell devient `calc(var(--content-max-width) + 232px)` : la colonne de contenu
conserve `--content-max-width`, et la largeur du rail (208 px) plus la
gouttière (24 px) sont des valeurs locales documentées. La gouttière et les
paddings utilisent les tokens d'espacement disponibles. `.header-nav` est
`position:sticky` avec un décalage local, à l'intérieur de la colonne
`#app-shell-root`.

Pourquoi : conserver `--content-max-width` pour Overview évite de rouvrir le
périmètre TS-066 et garantit que la zone de contenu ne rétrécit pas sous sa
largeur canonique à 1280 px.

Alternatives rejetées : agrandir `--content-max-width` (change un token
sémantique et le rendu Overview) ; largeur de rail en pourcentage (instable et
non bornée) ; grille à trois colonnes (aucune référence approuvée).

### 4. Une navigation unique, rail ou tiroir selon la largeur

`AppNavigation` reste rendu une seule fois. `AppHeader` conserve le bouton
`#nav-menu-button` et le panneau `#nav-menu-panel`, mais remplace l'attribut
`hidden` par un état `data-open="true|false"` :

- en dessous de 1024 px, le bouton est visible et le panneau est en tiroir
  absolu borné ; `[data-open="false"]` vaut `display:none` (donc absent de
  l'arbre d'accessibilité) ;
- à partir de 1024 px, le bouton est masqué et le panneau est le rail
  persistant toujours rendu et accessible.

Pourquoi : un simple override CSS de `[hidden]` laisserait un panneau visible
mais masqué pour les technologies d'assistance. L'état `data-open` rend la
visibilité réelle et l'exposition sémantique cohérentes aux deux paliers, sans
`matchMedia`, sans état React supplémentaire et sans second jeu de liens.

Alternatives rejetées : `hidden` piloté par `matchMedia` (nouvel état et
listener de viewport, plus difficile à tester de façon déterministe en jsdom) ;
deux composants de navigation (duplication) ; menu toujours ouvert sur desktop
via `open:true` (fausse l'état du contrôleur et la fermeture après navigation).

### 5. État courant par mapping pur route → destination

Une fonction pure de `site/core.js`, exportée et testée, associe la route
courante à un fragment de navigation : Overview et détail projet →
`#/`, section `root` → `#/parametres`, `data` → `#/parametres/donnees`,
`sync` → `#/parametres/synchronisation`. `AppNavigation` reçoit la route déjà
transmise par la surface et pose `aria-current="page"` sur le seul lien
correspondant ; le style actif réutilise `--color-surface-muted`,
`--color-action` et `--focus-outline`. Aucun lien actif n'est ajouté sur les
routes inconnues ou invalides.

Pourquoi : l'état est exposé sémantiquement sans introduire de routeur ni
d'historique parallèle, et le mapping reste vérifiable par test unitaire.

Alternatives rejetées : lire `location.hash` dans la coque (viole la
séparation routeur/coque) ; déduire l'état depuis le DOM ou le focus (non
sémantique) ; dupliquer la logique de `parseRoute` (risque de divergence).

### 6. Aucun changement de frontière ni de cycle de vie

`reconcileAppShell`, la clé de contexte, `createAppShellSurface`, la fermeture
par navigation/Échap/action extérieure et le focus sur le titre de destination
restent inchangés. Le rail étant toujours rendu sur desktop, la fermeture du
menu n'a d'effet visuel qu'en dessous de 1024 px ; l'état `open` continue
d'être réinitialisé aux frontières de route, d'identité et de blocage. Le
détail projet garde sa propre racine et n'est jamais remonté par un rendu de la
coque.

## Risks / Trade-offs

- **Tests TS-041/TS-063 fondés sur `hidden` et sur l'absence de sidebar** →
  mettre à jour ces assertions vers `data-open`, le rail approuvé et les
  nouveaux scénarios, sans affaiblir les vérifications de focus, de cibles et
  d'absence d'effet métier.
- **Rail sticky dans une cellule de grille** → vérifier que `.header-nav` est
  sticky à l'intérieur de `#app-shell-root` et que la colonne ne crée pas de
  débordement ; la recette réelle reste requise pour le ressenti de défilement.
- **Différence entre visibilité CSS et exposition AT** → utiliser
  `display:none`/`display:block` pilotés par le média et `data-open`, jamais un
  `[hidden]` rendu visible par CSS.
- **Mapping détail → « Mes projets » discutable** → documenter la convention
  et la rendre ajustable sans changer les routes ; la recette humaine vérifie
  la perception de l'état courant.
- **Fidélité visuelle Stitch non prouvée en CI** → les tests ne valident que
  les règles structurelles ; la comparaison `DESKTOP-1`/`M02`/`M32` reste dans
  `Manual acceptance`.
- **Régressions Overview** → n'ajuster que le conteneur (grille, gouttière,
  largeur) et exécuter les tests TS-064/TS-065/TS-066 existants.

## Migration Plan

1. Déplacer `#app-shell-root` comme enfant direct de `.shell` dans
   `site/index.html`, sans changer son identifiant ni son contenu de repli.
2. Adapter `AppHeader`/`AppNavigation` (`data-open`, `aria-current`) et ajouter
   le mapping pur dans `site/core.js`.
3. Ajouter les règles CSS du shell desktop et du tiroir compact, sans modifier
   `site/styles/tokens.css`.
4. Mettre à jour la documentation et les tests de coque existants, puis
   exécuter `npm run check`, `npm run build` et `npm run verify:build`.
5. Recette humaine desktop/mobile séparée, puis synchronisation sémantique et
   archivage OpenSpec hors `apply`.

**Retour arrière :** restaurer l'emplacement précédent de `#app-shell-root`
dans `.hero`, rétablir l'attribut `hidden` et les règles CSS de la barre
compacte, retirer le mapping d'état courant et les tests TS-067. Aucune
donnée, préférence, route, base IndexedDB, configuration Cloud ni export/import
n'est affectée.

## Open Questions

Aucune question bloquante : les références, la portée et la conservation des
quatre destinations sont décidées. Les écarts purement visuels constatés en
recette humaine seront traités dans le périmètre de présentation sans changer
les contrats de cette spécification.
