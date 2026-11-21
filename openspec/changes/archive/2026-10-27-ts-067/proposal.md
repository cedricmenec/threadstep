# Proposal

## Why

Le shell de navigation livré par TS-063 reste une barre compacte identique sur
toutes les largeurs : sur desktop, la navigation n'occupe pas la place latérale
visible dans la référence approuvée `DESKTOP-1` « Mes Projets - Vue d'ensemble »,
alors que le menu mobile `M02` et la planche `M32` servent déjà de repère pour
les largeurs compactes. TS-067 harmonise cette coque avec ces références sans
toucher aux surfaces métier ni aux comportements de navigation.

## What Changes

- Ajouter au shell une **navigation latérale persistante sur desktop**, à partir
  d'un point de rupture local documenté, en conservant exactement les quatre
  destinations, leur ordre, leurs libellés français et leurs fragments.
- Conserver, à 768 px et en dessous, le **bouton « Menu »** et son **tiroir**
  borné, lisibles à 320, 390, 430 et 768 px, sans débordement horizontal ni
  perte de libellé.
- Exposer l'**état de route courant** par un `aria-current` sémantique et une
  distinction visuelle utilisant les tokens existants.
- Réutiliser `site/app-shell/AppShell.jsx`, `AppHeader.jsx`,
  `AppNavigation.jsx`, `AppShellSurface.jsx`, `site/styles/tokens.css` et
  `site/ui/` ; ajuster la composition du conteneur Overview avec le shell sans
  refondre son contenu, propriété de TS-066.
- Mettre à jour le delta canonique `app-navigation` et la décision
  `docs/product/react-app-shell.md` pour décrire le shell desktop/mobile, le
  point de rupture local et les frontières de propriété inchangées.
- Ajouter des tests déterministes de parité des destinations, d'états
  responsive structurels, d'accessibilité exposée, d'absence d'effet métier et
  de non-régression de la coque.

## Capabilities

### New Capabilities

Aucune nouvelle capacité : le comportement reste celui de la navigation
existante.

### Modified Capabilities

- `app-navigation` : bouton et panneau responsives remplacés par un shell
  desktop à navigation latérale persistante et un tiroir compact ; exposition
  sémantique de la destination courante ; point de rupture local approuvé et
  mise à jour des scénarios de largeur sans changer routes, destinations ni
  effets métier.

## Impact

- `site/app-shell/` : composition du shell, rendu d'une navigation unique
  (rail desktop / panneau compact), `aria-current`, état ouvert/fermé sans
  duplication de liens.
- `site/core.js` : ajout d'un mapping pur route → fragment de navigation pour
  l'état courant, sans nouveau routeur ni nouvelle route.
- `site/index.html` : `#app-shell-root` reste l'unique hôte de l'en-tête et de
  la navigation ; son emplacement peut devenir un enfant direct de `.shell`
  pour permettre la disposition latérale, sans déplacer aucune surface métier.
- `site/styles.css` : grille du shell, rail desktop, tiroir compact, point de
  rupture local documenté et états de focus/actif.
- `tests/ts-067-*.test.mjs` et mise à jour des tests shell TS-041/TS-063
  devenus incompatibles avec le rail approuvé.
- `docs/product/react-app-shell.md` et `docs/product/developer-guide.md`.
- Aucun changement de valeurs de `site/styles/tokens.css`, de schéma Dexie, de
  route, de destination, de préférence, de persistance, d'export/import, de
  consentement, de sécurité, de dépendance ou de police/icône distante.

## Non-goals

- Ajouter une recherche, des archives, un partage, des échéances, des pièces
  jointes, une barre inférieure « Tâches / Projets / Focus / Chercher » ou une
  destination supplémentaire.
- Refondre le contenu d'Overview, ses cartes, données, tâches ou commandes
  (propriété TS-066) ou migrer une surface métier vers React.
- Introduire une nouvelle bibliothèque CSS, un framework, une dépendance, une
  palette, une police ou une icône distante.
- Modifier les routes, le routeur par fragment, l'historique, les règles
  métier, la persistance, la synchronisation, l'identité d'espace ou les
  exports/imports.
- Présenter une CI verte, des tests jsdom ou une revue statique comme une
  recette réelle de navigateur, de toucher, de clavier, d'appareil mobile ou de
  lecteur d'écran.

## Focus, scroll and transient-state invariants

- Un changement de route conserve les réinitialisations documentées
  (`hashchange`, fermeture du menu, focus sur le titre de destination) ; les
  liens, Échap, l'action extérieure et Précédent/Suivant gardent le
  comportement livré.
- L'ouverture ou la fermeture du tiroir compact ne déplace ni le scroll, ni le
  focus de la vue courante, et n'écrit aucune donnée ni préférence.
- Le rail desktop ne provoque ni remontage de la racine React du détail projet,
  ni réinitialisation de ses brouillons, listes, Undo, focus ou scroll.
- Aucun nouvel ordre de lecture ni piège de focus n'est introduit ; les cibles
  restent d'au moins 44 × 44 px et le focus visible utilise
  `--focus-outline`.

## Uncertainties and decisions

- **Références approuvées.** La fiche et le registre Stitch approuvent les
  maquettes comme références visuelles/UX pour cette portée : `DESKTOP-1`,
  `M02` et la planche `M32` (repère de style, sans certification
  d'accessibilité). Aucun approfondissement Stitch n'est requis. La fidélité
  visuelle au canvas reste à vérifier en recette humaine, pas en CI.
- **Largeurs 769–1023 px.** La fiche impose un rail à 1280 px et un tiroir à
  768 px et moins. Le plan retient un point de rupture technique local à
  `1024px` : rail persistant à partir de 1024 px, tiroir en dessous. Ce choix
  est documenté dans la décision d'architecture et la spécification ; il ne
  crée pas de nouvelle destination.
- **Destination courante sur le détail projet.** `#/sujet/<id>` n'est pas une
  destination de navigation. Le plan rattache visuellement et sémantiquement ce
  détail à « Mes projets » comme section parente, sans nouvelle route. Si le
  propriétaire préfère aucun état courant sur le détail, seule cette
  correspondance devra être ajustée pendant l'implémentation.
- **Dépendance TS-066.** La dépendance technique est satisfaite par la
  livraison fusionnée TS-066 (PR, CI indépendante et `main` vertes, Pages
  déployé) ; aucun GO manuel préalable n'est exigé. Les recettes humaines
  TS-066 non attestées restent `NOT_RUN` et ne sont pas converties en preuve.
- **Tokens.** Aucune valeur sémantique existante ne change. Le rail utilise des
  valeurs locales documentées (largeur et gouttière) combinées à
  `--content-max-width`, `--focus-outline` et `--control-target-min`.
