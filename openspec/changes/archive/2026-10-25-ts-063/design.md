# Design

## Context

Voir `proposal.md` — Why. L'état livré est le suivant :

- `site/index.html` contient l'en-tête `.hero`, le bouton `#nav-menu-button`, le
  panneau `#nav-menu-panel` et les quatre liens. Tous les formulaires OTP,
  Cloud, import/restauration, consentement et les pages de paramètres sont des
  sous-arbres vanilla de ce même document.
- `site/app.js` possède la route (`parseRoute` + `hashchange`), l'état transitoire
  `navMenuOpen`, le réducteur `navigationMenuState`, les handlers Échap/action
  extérieure, la fermeture sur changement de vue, le focus de titre
  (`routeHeadingId`) et le détail React via une frontière unique.
- `site/react-boundary.js` maintient aujourd'hui une seule surface active dans
  le conteneur `#subjects`. `site/react-adapter.js` et
  `site/project-detail/*` ne lisent que des instantanés et délèguent les
  commandes au contrôleur.
- `site/styles/tokens.css`, `site/ui/*` et les tests TS-061 fournissent les
  tokens, primitives et garde-fous réutilisables. La navigation actuelle est
  déjà couverte par `tests/ts-041-navigation.test.mjs`.
- Les portes produit ne sont pas levées à la date du plan : TS-060 ne donne
  qu'un GO pour TS-061, TS-061 n'a pas de recette physique complète et
  `docs/product/stitch-reference-catalog.md` porte
  `BLOCKED_PENDING_USER_VALIDATION` pour les références header/menu de TS-062.

Contrainte structurante : React ne doit pas devenir propriétaire des pages ni
des formulaires sensibles. La coque doit donc rester un sous-arbre fermé,
distinct de `#subjects` et de tous les panneaux métier.

## Goals / Non-Goals

**Goals :**

- Une coque React bornée à l'en-tête/menu, avec la même structure visible, les
  mêmes classes, IDs, libellés, ordre et comportements que le rendu livré.
- Deux conteneurs React indépendants et simultanés : en-tête et détail projet,
  chacun avec un propriétaire unique, sans écriture croisée.
- Une navigation dont la source de vérité reste le contrôleur vanilla : aucune
  route, aucun historique, aucun store ni préférence persistée en plus.
- Une fermeture/démontage propre aux frontières de route, d'identité et d'état
  bloquant, sans réinitialiser le détail ni les formulaires vanilla.
- Des preuves déterministes de rendu, ARIA, focus simulé, propriété DOM,
  coexistence, absence d'effet métier et contraintes responsive structurelles.

**Non-Goals :**

- Faire de React le propriétaire de `main`, des pages de paramètres, des cartes
  Overview, des tâches ou des formulaires Cloud/OTP/import.
- Choisir une nouvelle disposition visuelle, une sidebar, un tiroir mobile, un
  état actif `aria-current` ou une nouvelle référence Stitch non approuvée.
- Introduire un routeur, un state manager, un second document, une clé de
  stockage, une préférence de thème ou une dépendance.
- Modifier `site/core.js`, `site/react-adapter.js`, les commandes métier, Dexie,
  l'OTP, la CSP, les workflows ou les formats de données.

## Decisions

### 1. Vérifier les portes avant toute modification

Le premier travail d'`apply` est un contrôle déterministe des documents :

- GO humain TS-060 applicable au lot et recette documentée ;
- primitives/tokens TS-061 livrés et tests TS-061 verts ;
- sous-ensemble header/menu explicitement approuvé dans le catalogue TS-062,
  avec date, portée et références.

Si une porte manque, `apply` s'arrête sans modifier `site/`, `tests/` ou la
documentation produit, et rapporte le blocage. Cette vérification est une tâche
exécutable ; elle ne transforme pas une porte absente en succès.

*Alternative rejetée :* considérer les archives TS-061/TS-062 comme une
validation visuelle. Une archive prouve un travail livré, pas une décision
propriétaire sur les références ni une recette appareil.

### 2. Coque limitée à l'en-tête, pas un shell de page

`site/index.html` conserve `.hero`, le titre, le texte de confidentialité et
tout le contenu. Seul le bloc `.header-nav` est remplacé par un hôte dédié
`#app-shell-root`. Cet hôte conserve le markup statique actuel comme repli
initial ; au montage, React en prend la propriété et rend le même markup, sans
duplication simultanée. `AppShell` compose `AppHeader` (bouton + panneau) et
`AppNavigation` (les quatre liens).

La coque ne rend ni `main`, ni `#subjects`, ni les sections de paramètres. Elle
n'a donc aucun moyen de réécrire ou de remonter :

`#cloud-config`, `#cloud-activation`, `#auth-panel`, `#workspace-panel`,
`#export`, `#import`, `#restore`, `#restore-panel`, les consentements, les
panneaux de diagnostic ou `#subjects`.

*Alternative rejetée :* envelopper tout `main` dans `AppShell`. Cela ferait de
React le propriétaire apparent des formulaires vanilla, créerait des conflits de
démontage et élargirait le lot à une migration de page.

### 3. Deux instances de frontière, deux conteneurs

La coque utilise sa propre instance `createReactBoundary()` ; le détail garde
l'instance existante et `#subjects`. Chaque instance applique « au plus une
racine par conteneur ». Le total simultané est borné à deux conteneurs bornés :
l'hôte d'en-tête et le conteneur de détail.

Cela évite de modifier `site/react-boundary.js` et de risquer une régression du
pilote. La spécification `react-integration-boundary` est néanmoins ajustée
pour décrire explicitement cette coexistence et l'invalidation indépendante.

*Alternative rejetée :* une seule frontière globale avec une carte de
propriétaires. Plus générale, mais inutile pour deux conteneurs fixes et plus
risquée pour le code du détail déjà qualifié.

*Alternative rejetée :* un seul root React avec portails vers l'en-tête et le
détail. Cela couple les cycles de vie et les re-rendus des deux surfaces.

### 4. L'état du menu reste piloté par le contrôleur

`navMenuOpen`, `navigationMenuState`, les listeners Échap/action extérieure et
la fermeture sur `hashchange` restent dans `site/app.js`. La coque React est un
composant contrôlé : elle reçoit `open`, `route`, `onToggle`, `onNavigate` et
rend l'état exact. `updateNavigationMenu` met à jour l'état puis demande à la
surface un `update`. Le retour de focus à Échap utilise une méthode impérative
`focusMenuButton()` de la surface.

Les liens React appellent le même `activateNavigationLink` que le vanilla. Le
contrôleur ferme le menu, met à jour le fragment et confie le focus de titre à
`pendingNavigationFocus` / `applyFocus`. Aucun second routeur, aucune seconde
machine d'état de menu et aucun listener de lien dupliqué ne sont créés.

`site/app.js` cesse de muter directement `aria-expanded` et `hidden` et cesse
d'attacher des listeners aux liens du panneau ; ces responsabilités passent au
rendu React contrôlé. Les autres listeners document globaux restent uniques.

*Alternative rejetée :* un état `useState` interne au menu React. Cela
dupliquerait `navigationMenuState` et compliquerait la fermeture sur navigation
et la coordination avec le focus de titre.

### 5. Clé de contexte et cycle de vie de la coque

La coque est montée dans une frontière dont la clé inclut :

- la vue et la section ou l'identifiant de projet de la route ;
- l'identité autorisée (`authorizedWorkspaceIdentityKey`) ;
- l'état bloquant (`!businessAllowed()` ou lecture bloquante).

À chaque changement de clé, l'ancienne surface est démontée avant la création de
la nouvelle. Le menu démarre fermé. Un changement de route, Précédent/Suivant,
un changement d'identité ou un blocage ne peut donc pas restaurer un panneau
ouvert ni un contenu de l'ancien contexte. Sur une même clé, `update` rafraîchit
seulement l'état contrôlé du menu.

La coque ne contient aucune donnée métier ; son démontage/remontage ne peut pas
révéler un titre, une note, un compteur ou une identité. Les formulaires OTP et
Cloud restent dans le document vanilla et conservent leur état d'affichage
lorsqu'ils sont simplement masqués par la route.

*Alternative rejetée :* monter la coque une fois pour toute la session. Plus
simple, mais ne répond pas à l'exigence de démontage aux frontières d'identité
et d'état bloquant.

### 6. Coexistence avec le détail sans re-rendu croisé

La coque et le détail ont des adaptateurs et des frontières séparés :

| Sous-arbre | Propriétaire | Cycle de vie |
| --- | --- | --- |
| En-tête et menu | coque React | clé route/identité/blocage |
| `#subjects` en détail | surface détail React | clé vue/projet/identité |
| Overview, paramètres, formulaires | vanilla | route et contrôleur existants |

Une ouverture/fermeture de menu ne touche jamais `#subjects` ni l'adaptateur du
détail. Inversement, une commande du détail ne passe pas par la coque. Les
brouillons, parents développés, focus, scroll et Undo restent couverts par
`ux-interaction-continuity`, `react-project-detail-pilot` et
`react-project-detail-qualification`.

Aux frontières d'identité ou de lecture bloquée, `applyBusinessVisibility`,
`applyExpandedIdentityBoundary` et le rendu invalident la surface détail avant
le retour vanilla, puis la coque est remontée avec une nouvelle clé. Aucune
donnée de l'ancien contexte n'est conservée par la coque.

### 7. Structure, classes et parité graphique

`AppShell`, `AppHeader` et `AppNavigation` reprennent le markup actuel :

- conteneur `.header-nav` ;
- bouton `#nav-menu-button.nav-menu-button` de type `button`, avec
  `aria-expanded` et `aria-controls="nav-menu-panel"` ;
- icône décorative `aria-hidden="true"` et libellé texte « Menu » ;
- panneau `#nav-menu-panel.nav-menu-panel[hidden]` ;
- `nav.nav-menu` avec `aria-label="Navigation principale"` ;
- liens dans l'ordre exact de `NAV_MENU_ENTRIES` de `site/core.js`.

Aucun wrapper visuel supplémentaire n'est ajouté à l'intérieur de
`.header-nav`. Le CSS existant continue de cibler ces classes. Si l'hôte
`#app-shell-root` a besoin d'une règle, elle se limite à la largeur, au
`min-width:0`, au retour à la ligne et aux tokens TS-061 ; aucune nouvelle
palette, police, icône ou point de rupture n'est introduit.

L'état actif d'une destination (`aria-current`), une sidebar permanente ou un
tiroir mobile ne sont pas dans le contrat canonique actuel et ne sont pas
ajoutés sans référence approuvée.

### 8. Accessibilité et focus

Le bouton reste un `button` natif : Entrée et Espace déclenchent `onToggle`.
Le panneau est masqué par `hidden`. `aria-expanded` reflète exactement l'état
contrôlé. Échap ferme sans naviguer et `focusMenuButton()` replace le focus sur
le déclencheur. Une action extérieure et un changement de route ferment sans
retour de focus au bouton. Le focus de destination reste celui du contrôleur.

Les liens et le bouton conservent les cibles de 44 px des classes existantes.
Les libellés sont des nœuds texte. Les tests jsdom vérifient les attributs,
l'ordre Tab simulé et les callbacks uniques ; le focus perçu, le toucher et le
lecteur d'écran restent manuels.

### 9. Tests déterministes et build

Nouveau harnais `tests/helpers/ts-063-app-shell-harness.mjs` compilant les
composants avec esbuild et les montant dans jsdom, sur le modèle du harnais
TS-059. Fichiers ciblés :

- rendu/parité/ARIA : `tests/ts-063-app-shell-render.test.mjs` ;
- route, liens, focus de titre, Échap, extérieur, historique simulé :
  `tests/ts-063-app-shell-navigation.test.mjs` ;
- deux frontières et cycles coque/détail : `tests/ts-063-app-shell-boundary.test.mjs` ;
- absence d'écriture/réseau/OTP/commande et conservation des formulaires :
  `tests/ts-063-app-shell-side-effects.test.mjs` ;
- garde-fous CSS/largeurs/cibles/tokens et texte littéral :
  `tests/ts-063-app-shell-responsive.test.mjs` ;
- documentation, host, CSP, routes, absence de nouvelle clé de stockage :
  `tests/ts-063-app-shell-docs.test.mjs`.

Les tests TS-041, TS-042, TS-043, TS-052, TS-058, TS-059, TS-060 et TS-061
restent la référence de non-régression. `npm run check`, `npm run build` et
`npm run verify:build` complètent les preuves.

### 10. Documentation et retour arrière

Créer `docs/product/react-app-shell.md` avec la carte de propriété, les
fichiers, les points de montage, les frontières d'invalidation, les tests, les
limites et la procédure de retour arrière. Compléter
`docs/product/developer-guide.md` avec les commandes et la distinction
preuve automatisée / recette humaine.

Retour arrière : retirer l'import de la surface de coque, restaurer le markup
`.header-nav` statique, rétablir les listeners de menu du contrôleur, puis
supprimer les modules `site/app-shell/` s'ils ne sont plus consommés. Le détail
React, les données, les routes, les préférences et la configuration Cloud ne
sont pas affectés.

## Risks / Trade-offs

- **Portes produit non levées** → arrêt explicite avant toute modification ;
  aucune décision visuelle n'est inventée.
- **Double racine React** → deux instances de frontière et conteneurs disjoints ;
  tests de cycles et d'invalidation indépendante.
- **En-tête vide ou décalage au chargement** → l'hôte conserve le markup
  statique actuel jusqu'au montage React, qui le remplace par un markup et des
  classes identiques ; aucun déplacement de contenu métier n'est effectué.
- **Perte du menu si le montage React échoue** → le contrôleur ne possède plus
  les liens statiques ; le test de montage et le retour arrière documenté
  limitent ce risque. Aucun contournement par double rendu n'est autorisé.
- **Fermeture sur navigation mal coordonnée** → la coque est contrôlée par
  `app.js`, la clé de contexte est remontée à chaque route et les tests
  couvrent lien, Échap, extérieur, Précédent/Suivant.
- **Focus perdu sur un nœud détaché** → méthode de focus sur le bouton de la
  coque active, focus de titre conservé après navigation, tests jsdom ; recette
  clavier réelle séparée.
- **Régression du détail** → aucun import de l'adaptateur ou des commandes du
  détail dans la coque ; tests TS-059/TS-060 exécutés à chaque lot.
- **Largeur ou cible dégradée** → réutilisation des classes/tokens existants,
  tests structurels à 320/390/430/768/1280 et recette navigateur.
- **Dérive visuelle** → aucune référence Stitch n'étant approuvée, parité
  graphique stricte ; toute évolution est renvoyée à TS-062.

## Migration Plan

1. Vérifier les portes TS-060/TS-061/TS-062 ; si l'une manque, s'arrêter.
2. Capturer le markup, les classes, les attributs ARIA et les tests de
   navigation de référence dans des fichiers temporaires non versionnés.
3. Ajouter les composants et la surface de coque, sans les monter.
4. Remplacer le sous-arbre `.header-nav` par l'hôte dédié, brancher l'état de
   menu et les liens sur les handlers existants, mettre en place les deux
   frontières.
5. Ajouter les tests ciblés, la documentation et les mesures de build.
6. Exécuter les tests de non-régression, `npm run check`, `npm run build`,
   `npm run verify:build`, `openspec validate` et le contrôle de phases.
7. Conserver la recette humaine (desktop, tablette, Chrome Android, clavier,
   toucher, lecteur d'écran, Dexie Cloud de test) hors checklist.

Aucune migration de données n'est nécessaire : le changement ne crée ni base,
ni clé, ni route, ni préférence persistée.

## Open Questions

Aucune question bloquante pour le plan technique. Deux sujets restent
volontairement hors implémentation tant qu'une décision propriétaire n'existe
pas : l'état visuel actif d'une destination et la forme exacte d'un en-tête
« compact » issue des références Stitch. Le plan conserve le rendu actuel ; ces
choix ne modifient ni les specs ci-dessus ni la décomposition des tâches.
