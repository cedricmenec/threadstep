# Proposal

## Why

TS-059 a migré uniquement le détail projet `#/sujet/<id>` ; l'en-tête, le menu,
Overview et les paramètres restent rendus et pilotés par le contrôleur vanilla.
TS-063 doit maintenant faire évoluer **la coque et la navigation seules** vers
une présentation React bornée, sans second routeur ni second moteur de données,
afin de disposer d'une navigation responsive cohérente et testable tout en
conservant exactement les quatre destinations, les routes, la session et les
données existantes. Le risque principal n'est pas visuel : c'est la bascule de
propriété DOM entre coque, détail React et formulaires vanilla encore sensibles.

## What Changes

- Introduire un `AppShell`, un `AppHeader` et une navigation React de
  présentation dans un **hôte DOM dédié à l'en-tête**, avec les mêmes classes,
  identifiants, libellés et ordre de lecture que le rendu actuel. La coque ne
  contient ni page, ni formulaire OTP/Cloud, ni import/restauration, ni
  consentement, ni contenu métier.
- Conserver exactement les quatre destinations `Mes projets`, `Paramètres`,
  `Imports / Exports` et `Synchronisation Dexie Cloud`, dans cet ordre, avec les
  fragments `#/`, `#/parametres`, `#/parametres/donnees` et
  `#/parametres/synchronisation`, ainsi que la route existante `#/sujet/<id>`.
  Aucune nouvelle route, recherche, archive, sélection de compte ou navigation
  d'espace n'est ajoutée.
- Conserver la navigation par fragment et l'autorité du contrôleur existant :
  `parseRoute`, `hashchange`, `navigate`, `activateNavigationLink`,
  `routeHeadingId` et `navigationMenuState` restent les seuls mécanismes de
  route et de focus. Les composants React ne créent ni routeur ni historique
  parallèle.
- Faire de la coque React un propriétaire DOM **séparé** de la racine React du
  détail : deux conteneurs bornés distincts, au plus un propriétaire par
  conteneur, sans écriture croisée. La coque est démontée/remontée aux
  frontières de route, d'identité non autorisée ou d'état bloquant ; le détail
  React conserve ses commandes, son Undo, ses listes, son focus, son scroll et
  ses brouillons.
- Préserver l'état ouvert/fermé du menu, `aria-expanded`, `aria-controls`, le
  masquage du panneau, la fermeture par Échap, action extérieure ou changement
  de vue, le retour du focus au déclencheur et le focus sur le titre de
  destination.
- Garantir que l'ouverture/fermeture du menu, le montage/démontage de la coque
  et la navigation n'émettent aucune écriture IndexedDB/`localStorage`, aucune
  requête Cloud, aucun OTP, aucune migration et aucune copie de données. Aucun
  double listener ni double commande n'est introduit.
- Réutiliser les tokens et primitives TS-061, conserver les cibles de 44 px et
  le comportement responsive existant à 320, 390, 430, 768 et 1280 px, sans
  débordement horizontal ni interprétation HTML des libellés.
- Ajouter des tests déterministes de rendu, interactions, propriété DOM,
  coexistence coque/détail, absence d'effet métier, responsive structurel,
  accessibilité automatisable et non-régression des routes/données, puis
  vérifier `npm run check`, `npm run build` et `npm run verify:build`.
- Documenter la frontière de propriété, les fichiers, la procédure de retour
  arrière et la séparation entre preuves automatisées et recette humaine.

## Capabilities

### New Capabilities

Aucune. Le comportement de navigation existe déjà dans `app-navigation` et la
frontière React dans `react-integration-boundary` ; créer une capacité voisine
introduirait une duplication de contrat.

### Modified Capabilities

- `app-navigation` : ajouter le contrat de coque React bornée pour l'en-tête et
  le menu, la parité exacte des quatre destinations, la propriété DOM limitée à
  l'en-tête, les frontières de démontage/remontage, la préservation du détail
  React et des vues vanilla, ainsi que les scénarios d'accessibilité et de
  largeur déjà exigés par la navigation.
- `react-integration-boundary` : faire coexister deux conteneurs bornés
  distincts, la coque et le détail, avec au plus un propriétaire React par
  conteneur, sans écriture croisée, sans cumul de racines ou de listeners, et
  avec invalidation indépendante aux frontières de contexte.

## Impact

- `site/index.html` : remplacer le sous-arbre de navigation de l'en-tête par un
  hôte dédié, sans déplacer les formulaires OTP, Cloud, import/restauration,
  consentement, les panneaux de paramètres ni la racine `#subjects`.
- Nouveaux modules sous `site/app-shell/` pour `AppShell`, `AppHeader`,
  `AppNavigation` et la surface React bornée. Aucune dépendance nouvelle, aucun
  import Dexie/OTP/`persist()`.
- `site/app.js` : brancher la coque sur l'état de menu et les handlers de
  navigation existants, avec un hôte et une frontière distincts ; conserver
  `parseRoute`, `hashchange`, `navigate`, `focusRouteHeading` et les commandes
  du détail. Aucune modification de `site/core.js`, de la persistance ou des
  règles métier.
- `site/styles.css` : ajustements bornés de l'en-tête/menu si l'hôte React
  l'exige, à parité graphique et avec les tokens existants ; aucune refonte
  Stitch, Tailwind, police ou ressource distante.
- `tests/ts-063-*.test.mjs` et adaptations ciblées des tests de navigation
  existants : rendu, clavier simulé, ARIA, focus, propriété DOM, coexistence,
  cycles de route/identité, absence d'écriture et garde-fous responsive.
- `docs/product/react-app-shell.md` et guides développeur concernés : frontière,
  points de montage, diagnostic, retour arrière, preuves et limites.
- Aucun changement de `AGENTS.md`, `.github/workflows/`, `opencode.json`,
  `backlog/`, `package.json`, `package-lock.json`, CSP, secrets, configuration
  Cloud, routes, identifiants IndexedDB ou formats d'export/import.

## Non-goals

- Migrer Overview, les cartes projet, les tâches, les éditeurs, les paramètres ou
  les formulaires Cloud vers React (UI-06 à UI-09).
- Ajouter une fonctionnalité, une route, une recherche, une archive, un partage,
  un espace, une sélection de compte, une sidebar permanente, Tailwind, Stitch
  ou une nouvelle palette.
- Déplacer la persistance, l'authentification OTP, les paramètres Cloud, les
  sauvegardes, l'import/restauration ou les consentements dans React.
- Modifier `site/core.js`, la configuration Dexie, les URLs publiques, les flux
  d'écriture, les workflows ou la politique de sécurité.
- Présenter une CI verte, un test jsdom ou une revue statique comme une recette
  navigateur, mobile, tactile, clavier ou lecteur d'écran.

## Uncertainties and decisions to confirm

- **Gates non satisfaits à la date de ce plan.** `TS-063` reste `proposed`.
  Le rapport TS-060 contient un GO humain explicite pour **TS-061 seulement** et
  ne vaut pas autorisation pour TS-063. Le catalogue TS-062 porte
  `BLOCKED_PENDING_USER_VALIDATION` : aucune référence header/menu n'est
  approuvée individuellement. `apply` doit donc s'arrêter avant toute
  modification si ces trois portes ne sont pas documentées comme levées.
- **Références visuelles absentes.** Aucun identifiant approuvé de maquette
  header/menu n'est disponible. Le plan conserve le rendu, les classes et la
  densité actuels ; il n'invente ni en-tête « compact », ni drawer, ni état
  actif `aria-current`, ni nouvelle disposition mobile. Toute évolution visuelle
  doit venir d'une validation propriétaire explicite dans TS-062.
- **Portée exacte d'`AppShell`.** Pour éviter de donner à React la propriété des
  pages, des formulaires et de `#subjects`, le plan limite la coque à l'en-tête
  et à la navigation. Un shell React qui engloberait `main` ou le contenu des
  pages serait une décision d'architecture distincte, non incluse ici.
- **Deux racines React simultanées.** La spécification actuelle
  `react-integration-boundary` décrit une seule racine active. Le plan modifie
  ce contrat pour autoriser exactement deux conteneurs bornés (en-tête et
  détail), chacun avec un propriétaire unique. Si la revue juge ce changement de
  contrat trop large, l'alternative est de reporter TS-063 plutôt que de forcer
  une coque non bornée.
- **Recette matérielle TS-061/TS-062 non prouvée par ce plan.** Les largeurs, le
  toucher, le clavier, le focus perçu, le lecteur d'écran et Dexie Cloud de test
  restent des vérifications humaines. Elles ne sont ni cochées ni revendiquées
  comme réalisées.
