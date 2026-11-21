# Coque React bornée — en-tête et navigation (TS-063, TS-067)

**Périmètre :** en-tête et navigation uniquement. Overview, Paramètres,
Imports / Exports, Synchronisation Dexie Cloud, les formulaires OTP/Cloud, les
sauvegardes, l'import/restauration et les consentements restent du rendu
vanilla. Aucune route, donnée, clé de stockage, préférence ou configuration
Cloud n'est ajoutée ou déplacée par cette migration.

## Carte de propriété DOM

| Sous-arbre | Propriétaire | Cycle de vie |
| --- | --- | --- |
| `#app-shell-root` (`.header-nav`, bouton Menu, rail/tiroir, liens) | coque React bornée | clé route / section / projet / identité autorisée / état bloquant |
| `#subjects` en détail projet | surface React du détail | clé vue / projet / identité |
| Overview, pages de paramètres, formulaires OTP/Cloud/import/restauration/consentement, panneaux de diagnostic | vanilla (`site/app.js`) | route et contrôleur existants |

Chaque conteneur possède au plus un propriétaire React. La coque et le détail
utilisent deux instances distinctes de `createReactBoundary()` et deux
conteneurs disjoints ; aucune écriture croisée n'est autorisée. Le total
simultané de conteneurs React actifs est borné à deux. Le déplacement de l'hôte
ne change ni son identifiant, ni son propriétaire, ni le routeur.

## Placement de l'hôte et shell responsive

`#app-shell-root` est l'unique hôte de la coque et devient un enfant direct de
`<main class="shell">`, placé avant `.hero`. Il reste séparé de `#subjects` et
de toutes les surfaces métier. À partir du point de rupture local, `.shell`
devient une grille à deux colonnes : rail de navigation en colonne 1, contenu
en colonne 2. La colonne de contenu conserve `--content-max-width` via
`minmax(0,var(--content-max-width))` ; la largeur maximale du shell est
`calc(var(--content-max-width) + 232px)`, avec une largeur de rail locale de
208 px et une gouttière de 24 px. `min-width:0` et `max-width:100%` empêchent
tout débordement horizontal et aucun `overflow-x` n'est introduit.

Sous le point de rupture, le shell reste en flux vertical et le panneau
redevient un tiroir absolu borné par la largeur disponible.

## Rail desktop et tiroir compact

La coque rend **une seule** navigation avec exactement les quatre destinations
existantes, dans l'ordre et avec les fragments de `NAV_MENU_ENTRIES`. Le bouton
natif « Menu » et le panneau `#nav-menu-panel` sont les mêmes aux deux paliers :

- **Desktop (≥ 1024 px) :** le bouton est masqué en CSS ; le panneau est le
  rail persistant toujours visible et accessible, sans ouverture préalable. Le
  rail est sticky dans sa colonne et aucun lien n'est dupliqué.
- **Compact (< 1024 px) :** le bouton « Menu » est visible et ouvre le tiroir.
  Le panneau expose `data-open="true|false"` ; l'état fermé vaut `display:none`
  et sort donc de l'arbre d'accessibilité, sans utiliser un `hidden` rendu
  visible par CSS.

Le bouton conserve `aria-expanded`, `aria-controls`, son nom « Menu » et une
cible d'au moins 44 × 44 px. `site/app.js` reste l'autorité : il transmet
`open`, `route`, `onToggle` et `onNavigate`, ferme le menu après navigation,
Échap et action extérieure, et replace le focus sur le bouton après Échap.

## Point de rupture local

Le point de rupture est **1024 px**, écrit littéralement dans
`@media(min-width:1024px)` car une custom property ne peut pas être consommée
de façon fiable dans une media query. Il est documenté ici et dans la
spécification `app-navigation` : rail persistant à partir de 1024 px, tiroir à
768 px et en dessous. Le palier compact `620px` existant reste utilisé pour la
densité de la page. Aucun autre palier de disposition n'est introduit.

## Points de montage

- `site/app-shell/AppShell.jsx` compose `AppHeader` (bouton `#nav-menu-button`
  et panneau `#nav-menu-panel`) et `AppNavigation` (les quatre liens issus de
  `NAV_MENU_ENTRIES`, avec `aria-current`).
- `site/app-shell/AppShellSurface.jsx` expose `update`, `unmount` et
  `focusMenuButton`.
- `site/app.js` monte la surface dans `#app-shell-root` via `reconcileAppShell`
  et conserve l'unique autorité de route : `parseRoute`, `hashchange`,
  `navigate`, `activateNavigationLink`, `routeHeadingId` et
  `navigationMenuState`.
- `site/index.html` conserve le markup statique de repli dans
  `#app-shell-root` ; React le remplace au montage par un markup équivalent.
  Les formulaires et `#subjects` restent hors de cet hôte.

## Frontières route, identité et blocage

La clé de contexte de la coque agrège la vue, la section ou l'identifiant de
projet, l'identité autorisée et l'état bloquant. À chaque changement de clé,
l'ancienne coque est démontée avant le montage de la suivante et le menu
démarre fermé. Une identité non vérifiée, un espace incompatible ou une
lecture bloquante invalident la coque sans révéler de contenu du contexte
précédent. Le détail React est invalidé indépendamment, avant toute réécriture
vanilla de `#subjects`.

## Focus, scroll et continuité

L'ouverture ou la fermeture du tiroir ne déplace ni le scroll ni le focus de la
vue courante et n'écrit aucune donnée ni préférence. Un changement de route
conserve les réinitialisations documentées (`hashchange`, fermeture du menu,
focus sur le titre de destination). Le rail desktop ne remonte jamais la racine
React du détail projet et ne réinitialise ni ses brouillons, ni ses listes, ni
l'Undo, ni son focus, ni son scroll. Les fins de course Précédent/Suivant et la
fermeture après navigation restent celles du contrôleur existant. Aucun piège
de focus ni nouvel ordre de lecture n'est introduit ; le focus visible utilise
`--focus-outline` et les cibles `--control-target-min`.

## État de destination courante

`navigationFragmentForRoute(route)` est une fonction pure de `site/core.js`.
Elle rattache Overview, le détail projet et le repli de route au lien
« Mes projets », puis chaque section de paramètres à sa destination. La coque
pose `aria-current="page"` sur le seul lien correspondant. Le style actif
réutilise `--color-surface-muted`, `--color-action`, `--font-weight-bold` et une
barre intérieure, donc la distinction ne dépend pas de la seule couleur. Une
route non interprétable n'invente aucun lien actif.

## Dépendance TS-066

La dépendance technique est satisfaite par la livraison fusionnée TS-066
(PR, CI indépendante et `main` vertes, Pages déployé). Aucun GO manuel
préalable n'est exigé pour cette dépendance. Les recettes humaines TS-066 non
attestées restent `NOT_RUN` et ne sont pas converties en preuve.

## Diagnostic

```sh
node --test tests/ts-067-navigation-state.test.mjs \
  tests/ts-067-app-shell-layout.test.mjs \
  tests/ts-067-app-shell-responsive.test.mjs \
  tests/ts-067-docs.test.mjs
node --test tests/ts-063-app-shell-render.test.mjs \
  tests/ts-063-app-shell-navigation.test.mjs \
  tests/ts-063-app-shell-boundary.test.mjs \
  tests/ts-063-app-shell-side-effects.test.mjs \
  tests/ts-063-app-shell-responsive.test.mjs \
  tests/ts-063-app-shell-docs.test.mjs
node --test tests/ts-041-navigation.test.mjs tests/ts-058-react-boundary.test.mjs \
  tests/ts-059-project-detail-integration.test.mjs tests/ts-060-project-detail-transitions.test.mjs
npm run check
npm run build
npm run verify:build
```

Les tests jsdom prouvent le markup, les attributs ARIA, l'ordre, les
callbacks uniques, la propriété DOM, l'absence d'effet métier et les règles
structurelles de largeur. Ils ne prouvent ni le rendu visuel, ni le toucher,
ni le focus perçu, ni le lecteur d'écran, ni un débordement réel sur appareil.

## Retour arrière

Restaurer l'emplacement précédent de `#app-shell-root` dans `.hero`, retirer le
mapping d'état courant et les tests TS-067, rétablir l'attribut `hidden` et les
règles CSS de la barre compacte, puis supprimer les règles
`/* TS-067 ... */ ... /* End TS-067 */`. Aucune donnée, préférence, route, clé
de stockage, base IndexedDB, configuration Cloud ni export/import n'est
affecté.

## Preuves automatisées et recette humaine

- **Automatisé :** routes et fragments inchangés, parité des quatre
  destinations, rendu et ARIA de la coque, `aria-current`, fermeture par
  navigation/Échap/action extérieure, focus du bouton et du titre, deux
  frontières, cycles sans accumulation, absence d'écriture/requête réseau/OTP/
  commande, règles de largeur et de cible, tokens, CSP et build.
- **Humain (non coché par `apply` ni par la CI) :** parcours desktop, tablette
  et Chrome Android, comparaison à `DESKTOP-1`, `M02` et `M32`, menus au
  toucher, Tab/Entrée/Espace/Échap, lecteur d'écran, largeurs réelles
  320/390/430/768/1280 px, continuité d'une session Dexie de test sans OTP ni
  transfert implicite. Ces scénarios restent à vérifier et sont consignés
  séparément.

## Limites

Les références Stitch approuvées pour TS-063 se limitent à M01, M02, M15, M16 et M19. TS-067 ajoute `DESKTOP-1`, `M02` et la planche `M32` comme références
visuelles et UX de la coque ; `M32` n'est pas une certification
d'accessibilité. Une CI verte, un test jsdom ou une revue statique ne valent
pas recette visuelle, tactile, clavier, Chrome Android ou lecteur d'écran. La
fidélité au canvas et la perception de l'état courant restent une recette
humaine, non cochée par `apply` et consignée `NOT_RUN` tant qu'elle n'a pas été
réellement effectuée. Overview et les paramètres restent hors de cette
migration de coque.
