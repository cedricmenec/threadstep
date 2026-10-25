# Coque React bornée — en-tête et navigation (TS-063)

**Périmètre :** en-tête et menu de navigation uniquement. Overview, Paramètres,
Imports / Exports, Synchronisation Dexie Cloud, les formulaires OTP/Cloud, les
sauvegardes, l'import/restauration et les consentements restent du rendu
vanilla. Aucune route, donnée, clé de stockage, préférence ou configuration
Cloud n'est ajoutée ou déplacée par cette migration.

## Carte de propriété DOM

| Sous-arbre | Propriétaire | Cycle de vie |
| --- | --- | --- |
| `#app-shell-root` (`.header-nav`, bouton Menu, panneau, liens) | coque React bornée | clé route / section / projet / identité autorisée / état bloquant |
| `#subjects` en détail projet | surface React du détail | clé vue / projet / identité |
| Overview, pages de paramètres, formulaires OTP/Cloud/import/restauration/consentement, panneaux de diagnostic | vanilla (`site/app.js`) | route et contrôleur existants |

Chaque conteneur possède au plus un propriétaire React. La coque et le détail
utilisent deux instances distinctes de `createReactBoundary()` et deux
conteneurs disjoints ; aucune écriture croisée n'est autorisée. Le total
simultané de conteneurs React actifs est borné à deux.

## Points de montage

- `site/app-shell/AppShell.jsx` compose `AppHeader` (bouton `#nav-menu-button`
  et panneau `#nav-menu-panel`) et `AppNavigation` (les quatre liens issus de
  `NAV_MENU_ENTRIES`).
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

Le menu se ferme après un lien, sur `hashchange` (Précédent/Suivant), par
Échap et par une action extérieure. Échap replace le focus sur le bouton Menu ;
une navigation ou une action extérieure ne déplacent pas le focus vers un nœud
détaché.

## Diagnostic

```sh
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

Retirer l'import de `createAppShellSurface` dans `site/app.js`, restaurer le
markup `.header-nav` statique hors de `#app-shell-root` et rétablir les
listeners de menu du contrôleur, puis supprimer `site/app-shell/` s'il n'est
plus consommé. Aucune donnée, préférence, route, clé de stockage, base
IndexedDB, configuration Cloud ni export/import n'est affecté.

## Preuves automatisées et recette humaine

- **Automatisé :** routes et fragments inchangés, rendu et ARIA de la coque,
  fermeture par navigation/Échap/action extérieure, focus du bouton et du
  titre, deux frontières, cycles sans accumulation, absence d'écriture/requête
  réseau/OTP/commande, garde-fous de largeur et de cible, CSP et build.
- **Humain (non coché par `apply` ni par la CI) :** parcours desktop, tablette
  et Chrome Android, menus au toucher, Tab/Entrée/Espace/Échap, lecteur
  d'écran, largeurs réelles 320/390/430/768/1280 px, continuité d'une session
  Dexie de test sans OTP ni transfert implicite. Ces scénarios restent à
  vérifier et sont consignés séparément.

## Limites

Aucun état actif `aria-current`, aucune sidebar permanente, aucun tiroir
mobile, aucune recherche, archive ou sélection de compte n'est introduit. Les
références Stitch approuvées se limitent à M01, M02, M15, M16 et M19 pour
TS-063. Overview et les paramètres restent hors de cette migration.
