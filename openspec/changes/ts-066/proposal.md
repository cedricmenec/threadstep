# Proposal

## Why

La route Overview `#/` fonctionne aujourd'hui, mais sa hiérarchie visuelle et
ses espacements restent hétérogènes entre mobile et desktop, alors que les
références Stitch M01 « Mes projets / Overview », la référence desktop locale
`DESKTOP-1` « Mes Projets - Vue d'ensemble » et la planche responsive `M32` sont
approuvées pour la présentation et l'UX. TS-066 doit rapprocher cette page de
ces références sans modifier le comportement, les données ni la frontière React
livrés par TS-064 et TS-065.

## What Changes

- Harmoniser la composition visuelle de la route `#/` : hiérarchie du titre et
  de la synthèse, espacement des cartes projet, lisibilité des aperçus de
  tâches, densité des contrôles et adaptation aux largeurs 320, 390, 430, 768
  et 1280 px.
- Appliquer ces ajustements avec les composants React existants
  (`ProjectCard.jsx`, `OverviewTaskList.jsx`, `OverviewCards.jsx`), les
  primitives `site/ui/` et les tokens sémantiques de `site/styles/tokens.css`.
- Conserver l'ordre, les surfaces et les commandes existants : navigation
  contractuelle à quatre destinations, synthèse et compteurs, filtre de
  complétion, reprise manuelle, suggestion déterministe, urgences, formulaire
  de projet, cartes, aperçus de tâches et états de lecture.
- Préserver les routes hash, les données, IndexedDB/Dexie Cloud, l'identité
  d'espace, le consentement, la sauvegarde/restauration, les règles métier, les
  noms accessibles, les identifiants et les ordres de lecture.
- Ajouter les tests déterministes de garde-fou visuel/responsive et mettre à
  jour la documentation de présentation Overview et le guide développeur.

## Capabilities

### New Capabilities

- `overview-visual-harmonization` : présentation visuelle et responsive de la
  route Overview, composition des zones existantes, hiérarchie des cartes et
  des aperçus de tâches, réutilisation des composants/tokens et préservation
  observable des comportements, de l'accessibilité et des états.

### Modified Capabilities

Aucune exigence canonique existante n'est modifiée. Les capacités
`react-overview-cards`, `react-overview-interactions`,
`overview-project-metrics`, `overview-project-read-state`,
`overview-urgency-filter`, `overview-urgency-list`,
`subject-overview-preview`, `next-action-suggestion`, `resume-tracking`,
`app-navigation`, `task-hierarchy-presentation`,
`semantic-design-tokens` et `ux-interaction-continuity` restent les contrats
de référence.

## Impact

- `site/styles.css` : ajustements de composition, typographie, couleurs,
  espacements et responsive strictement dans le périmètre de la page Overview.
- `site/styles/tokens.css` : lecture seule ; aucune valeur de token existant
  n'est modifiée et aucun nouveau token n'est nécessaire.
- `site/overview/` : composants React réutilisés sans changement de logique ni
  de propriétaire DOM ; aucune nouvelle couche, dépendance ou route.
- `tests/ts-066-*.test.mjs` : contrôles déterministes de parité DOM, de
  réutilisation des tokens, de responsive structurel, d'absence de dépendance
  ou d'effet de bord.
- `docs/product/react-overview-cards.md`, `docs/product/developer-guide.md` et
  éventuellement une fiche de présentation TS-066 sous `docs/product/`.
- Aucun changement de `site/core.js`, `site/app.js` (hors ajustement de style
  impossible en CSS, à éviter), `site/react-*.js`, `package.json`,
  `package-lock.json`, `AGENTS.md`, workflows, `backlog/`, schéma Dexie,
  routes, CSP, préférences ou formats d'import/export.

## Non-goals

- Ajouter une recherche, des archives, du partage, des échéances, des pièces
  jointes, un historique, des statistiques ou de nouvelles destinations.
- Introduire une sidebar, une nouvelle barre de navigation, la barre inférieure
  « Tâches / Projets / Focus / Chercher » ou une refonte des autres écrans.
- Migrer de nouvelles surfaces vers React, changer la propriété DOM, déplacer
  la frontière React ou modifier les commandes et écritures existantes.
- Modifier une règle métier, un libellé, une validation, une route, une
  préférence, une donnée persistée ou un contrat de sécurité.
- Ajouter Tailwind, une bibliothèque d'icônes, une police distante, un CDN ou
  une nouvelle palette.
- Remplacer les tests par une capture, une CI verte ou une revue Stitch pour
  déclarer une recette réelle clavier, tactile, mobile ou lecteur d'écran.

## Uncertainties and decisions

- **Références approuvées.** Le périmètre visuel s'appuie sur l'approbation
  globale des maquettes du 27 octobre 2026 et sur l'inspection consignée de
  M01 et `DESKTOP-1`. `M32` reste `NOT_REVIEWED` comme planche de composants ;
  elle est utilisée comme repère de style, pas comme certification
  d'accessibilité. Les états non observés restent à vérifier en recette
  humaine.
- **Adaptation desktop.** La référence desktop montre une navigation latérale
  et des commandes hors périmètre. TS-066 n'ajoute ni sidebar ni nouvelle
  commande : l'harmonisation desktop se fait dans la coque et la disposition
  actuelles. Aucune décision produit supplémentaire n'est requise pour cette
  limite.
- **Valeurs de tokens.** Les couleurs, espaces, rayons et cibles tactiles
  existants sont conservés. Une éventuelle correction de palette ou de
  contraste sous les cibles documentées serait un changement sensible distinct
  et n'est pas décidée par ce plan.
- **TS-065.** La dépendance technique est satisfaite par la livraison
  TS-065 ; aucun GO manuel préalable n'est exigé. Les scénarios de recette
  humaine TS-065 non attestés restent `NOT_RUN` et ne sont pas convertis en
  preuve par ce changement.

## Focus, scroll and transient-state invariants

- Aucun ordre DOM, identifiant, classe, nom accessible ou commande n'est
  réordonné ou remplacé ; la mise en page est ajustée sans déplacer la
  frontière React ni l'ordre de lecture.
- Le focus visible et le focus après action restent ceux du rendu livré ; les
  nouveaux styles conservent un contour visible et ne créent pas de piège de
  focus.
- L'ancrage de scroll, les parents développés, les menus ouverts, les brouillons
  et le filtre restent continus lors d'une mise à jour de même vue et de même
  identité.
- Les frontières de route, de rechargement, d'import/restauration et de
  changement d'identité conservent leurs réinitialisations documentées.
