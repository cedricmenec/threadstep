# Proposal

## Why

Le détail projet React livré par TS-059 répète encore à la main ses boutons,
ses champs et ses sélecteurs de priorité, tandis que les valeurs de couleur,
d'espacement, de focus et d'erreur restent dispersées dans `site/styles.css`.
TS-061 doit fournir un socle partagé, sémantique et accessible qui réduit ces
duplications sans changer l'interface familière, sans migrer Overview et sans
imposer React aux routes encore vanilla.

## What Changes

- Ajouter un catalogue versionné de tokens CSS sémantiques pour couleur,
  typographie, espacement, rayons, focus, erreur, état désactivé et responsive.
  Les valeurs existantes sont mappées en priorité pour préserver la parité
  graphique ; aucune nouvelle palette, police distante ou bibliothèque
  d'icônes n'est introduite.
- Ajouter dans un emplacement partagé (`site/ui/`) un petit nombre de
  primitives React de présentation choisies d'après les duplications réelles :
  bouton, contrôle de priorité et champ texte. Leurs props, variantes et états
  sont explicites ; elles ne contiennent ni règle métier, ni accès Dexie, OTP,
  `persist()`, routeur ou second store.
- Réutiliser au moins deux de ces primitives dans la surface React du détail
  projet, en conservant exactement les éléments HTML, classes, libellés,
  noms accessibles, ordre de lecture et commandes existants. Overview,
  Paramètres, Imports / Exports, Synchronisation et la navigation restent
  vanilla.
- Documenter les conventions de tokens, composants, styles, états, contraste,
  cibles tactiles, responsive et intégration progressive des maquettes
  validées. Les éléments vanilla peuvent consommer les mêmes variables CSS
  sans être migrés vers React.
- Ajouter des tests déterministes de tokens, rendu, variantes, états,
  interactions, parité DOM et garde-fous responsive structurels, ainsi que les
  assertions d'accessibilité automatisables. Les vérifications de navigateur
  réel, de toucher, de clavier, de lecteur d'écran et de contraste perçu
  restent dans `Manual acceptance`.
- Conserver le build Vite, la CSP stricte, les chemins `/threadstep/`, les
  routes, les données, les identifiants, les formats d'export/import et les
  flux métier existants. Aucun changement de persistance, de synchronisation,
  de workflow ou de configuration protégée.

## Capabilities

### New Capabilities

- `semantic-design-tokens` : catalogue centralisé et versionné de tokens
  sémantiques, livré localement par Vite, préservant les valeurs existantes et
  rendant mesurables les objectifs de contraste, de focus, de cible tactile et
  de stabilité responsive.
- `react-presentation-primitives` : primitives React de présentation avec props,
  variantes et états explicites, sans effet métier, réutilisées dans le détail
  projet avec parité de classes, libellés, ordre de lecture et comportement.

### Modified Capabilities

- Aucune. Les capacités existantes `react-project-detail-pilot`,
  `react-integration-boundary`, `ux-interaction-continuity`,
  `task-actions-menu`, `action-editing`, `substep-collapse`,
  `frontend-security-boundary` et `static-build-pipeline` conservent leurs
  exigences : TS-061 les applique sans les réécrire.

## Non-goals

- Adopter Tailwind, un kit Stitch intégral, une nouvelle couleur, une nouvelle
  police, une bibliothèque d'icônes ou une feuille CSS distante.
- Refondre Overview, les paramètres, la navigation, les formulaires Cloud ou la
  mise en page générale ; convertir l'application en Stitch.
- Modifier les règles métier de `site/core.js`, l'adaptateur, les commandes du
  contrôleur, la persistance Dexie/IndexedDB, les routes, la CSP, les données,
  les sauvegardes ou la synchronisation.
- Créer un routeur, un state manager, un second store, une préférence
  persistée, une clé de stockage ou une migration.
- Déclencher automatiquement la conversion d'une autre vue après la livraison
  de ce socle.

## Impact

- `site/styles.css` et un nouveau fichier de tokens sous `site/styles/` :
  définition des variables sémantiques et remplacement borné des valeurs des
  primitives, états de focus, boutons, priorités, champs, erreurs, états
  désactivés et espacements responsive, à valeur graphique identique.
- Nouveaux modules `site/ui/*.jsx` et utilitaires de libellés de priorité,
  importés par les composants du détail projet. Aucune nouvelle dépendance.
- `site/project-detail/*.jsx` : adoption des primitives sans changer la
  propriété DOM, l'adaptateur, les commandes ni les classes consommées par
  `site/app.js` et les tests existants.
- `docs/product/ui-foundation.md`, `docs/product/developer-guide.md` et
  `docs/architecture.md` : tokens, primitives, états, accessibilité, exceptions
  mesurées, intégration progressive et retour arrière.
- `tests/ts-061-*.test.mjs` et adaptations ciblées du harnais existant :
  assertions de tokens, contraste calculé, rendu/variantes/états, parité des
  classes et libellés, non-régression des interactions, absence d'écriture et
  garde-fous responsive structurels.
- Aucun changement de `package.json`, `package-lock.json`, `site/index.html`,
  `.github/workflows/*`, `AGENTS.md`, `opencode.json`, `backlog/`, secrets,
  identifiants IndexedDB, URL Cloud, routes ou format JSON.

## Uncertainties and blocking decisions

- **Porte TS-060 actuellement fermée.** `docs/product/react-project-detail-qualification.md`
  conclut aujourd'hui à un **NO-GO borné** tant que la recette physique
  desktop/Android/clavier/tactile/lecteur d'écran n'a pas produit de preuves
  `PASS` et qu'une décision humaine explicite n'a pas été consignée. La fiche
  TS-061 interdit de modifier la surface React livrée dans ce cas. Ce plan est
  donc préparé, mais `apply` doit s'arrêter avant toute modification de
  `site/` tant que le rapport TS-060 ne porte pas un GO favorable. Aucun GO
  n'est inventé par ce changement.
- **Exceptions de contraste préexistantes.** La palette actuelle contient des
  valeurs sous les cibles d'accessibilité : focus `#a9ba69` sur blanc
  (environ 2,1:1), texte secondaire `#859087` sur blanc (environ 3,3:1) et
  certains badges de priorité. TS-061 ne crée pas de nouvelles couleurs et ne
  tranche pas une correction de palette : le plan conserve les valeurs, mesure
  les ratios et consigne ces exceptions comme préexistantes. Une correction
  éventuelle exige une décision produit et une tâche distincte.
- **Inventaire exact des primitives.** Le plan retient trois primitives
  justifiées par des duplications observées (bouton, contrôle de priorité,
  champ texte). Ajouter une primitive sans consommateur réel, ou en retirer une
  qui reste nécessaire à la parité, serait un ajustement de design borné ; le
  contrat exige au moins deux primitives réellement utilisées dans le détail.
- **Aucune preuve réelle par ce plan.** Les largeurs 320, 390, 430, 768 et
  1280 px, le toucher, le clavier, le focus perçu et le lecteur d'écran ne sont
  pas prouvés par les tests déterministes. Ils restent des vérifications
  humaines obligatoires, non cochées et non revendiquées comme réalisées.
