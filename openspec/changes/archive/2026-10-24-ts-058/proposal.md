# Proposal

## Why

ThreadStep doit préparer une migration progressive vers React sans modifier
l'apparence, les usages actuels, les URLs ni la persistance. Le risque principal
n'est pas React lui-même, mais la coexistence de deux renderers dans le même
sous-arbre DOM et l'apparition d'une seconde logique métier ou d'écritures
implicites. Ce changement établit donc une frontière d'intégration bornée,
testable et réversible **avant** le premier pilote de TS-059.

## What Changes

- Ajouter `react` et `react-dom` à des versions exactes, installables par
  `npm ci`, avec un lockfile reproductible. Ajouter une infrastructure de test
  DOM déterministe épinglée, sans l'activer dans le build de production.
- Configurer et documenter le traitement JSX local par Vite/esbuild en runtime
  automatique, sans Babel, sans CDN, sans script inline et sans assouplir la
  CSP de production.
- Définir une frontière DOM explicite pour **une seule** surface de présentation
  bornée, destinée à la vue détail d'un projet dans TS-059 : une racine React
  active possède exclusivement son conteneur ; le renderer vanilla ne remplace
  jamais ses descendants ; la racine est démontée avant tout retour au rendu
  vanilla. Les montages cumulés et les listeners dupliqués sont interdits.
- Définir un adaptateur de présentation étroit entre le contrôleur existant et
  la future surface : instantané métier en lecture seule, identifiants stables,
  état UI transitoire séparé, commandes explicitement nommées, notification de
  rafraîchissement et invalidation sur changement de route, d'identité autorisée
  ou d'état de chargement bloquant.
- Réutiliser `site/core.js`, les identifiants, les validations et le flux
  d'écriture existants. Aucun second store métier, aucune écriture au montage,
  au rendu ou au démontage, aucune souscription directe de React à Dexie Cloud
  ou à l'OTP.
- Ajouter une fixture React synthétique et des tests déterministes qui montent,
  démontent, naviguent et rafraîchissent sans activer de fonctionnalité React
  métier en production.
- Documenter les fichiers concernés, le point de bascule réversible vers le
  vanilla, l'écart de taille du build, le diagnostic et les limites de
  vérification. Aucune préférence persistée, nouvelle route publique ou
  opération de données n'est créée par le mécanisme de bascule.

## Capabilities

### New Capabilities

- `react-integration-boundary`: contrat observable du socle React dormant :
  dépendances exactes, compilation JSX locale et statique, propriété DOM
  exclusive, adaptateur en lecture seule, commandes existantes, invalidation
  des contextes et retour réversible au vanilla sans effet métier.

### Modified Capabilities

Aucune. Les exigences canoniques de `app-navigation`,
`ux-interaction-continuity`, `workspace-identity-isolation`,
`frontend-security-boundary`, `static-build-pipeline`, `subject-detail-view`,
`local-indexeddb-persistence` et du pilotage Cloud/OTP restent inchangées. Ce
changement exige explicitement leur préservation et les référence sans les
réécrire.

## Impact

- `package.json` et `package-lock.json` : `react` et `react-dom` à versions
  exactes, outillage DOM de test en `devDependencies`, versions verrouillées,
  sans modification des versions `dexie`/`dexie-cloud-addon` ni des commandes
  existantes.
- `vite.config.mjs` : traitement JSX automatique local, sans nouvelle entrée
  runtime, sans modification de la base `/threadstep/`, du vendor Dexie ni de la
  CSP de production.
- Nouveaux modules applicatifs étroits : frontière de propriété DOM et
  adaptateur de présentation, sans import Dexie/OTP et sans second store.
- `site/app.js` : intégration minimale des garde-fous de propriété et
  d'invalidation, sans changement du rendu vanilla tant que TS-059 n'est pas
  appliquée.
- `tests/` : fixture React synthétique, tests de montage/démontage, de
  propriété DOM, de listeners, d'adaptateur, d'invalidation, de non-écriture,
  de stabilité des identifiants et de non-régression des URLs/hash.
- `docs/product/developer-guide.md` et `docs/architecture.md` : frontière React,
  JSX, CSP, diagnostic, écart de taille et retour arrière.
- Aucun changement de `.github/workflows/*`, `AGENTS.md`, secrets, permissions,
  scripts ASF protégés, schéma IndexedDB, base locale, format JSON, configuration
  Cloud ou routes publiques.

## Non-goals

- Migrer ou activer une vue métier React en production ; TS-059 reste le
  premier pilote et n'est pas autorisé par ce changement.
- React sur Overview, la navigation, Paramètres, la Synchronisation, l'OTP,
  Dexie Cloud, l'import/export ou la restauration.
- Tailwind, design system, maquettes Stitch, refonte graphique, nouvelle
  fonctionnalité, nouvelle route publique ou préférence persistée.
- Migration de données, changement de nom ou de schéma IndexedDB, second store
  métier, Redux ou bibliothèque de state management.
- Modification des workflows Pages/CI, de la publication, des protections, des
  secrets ou des mécanismes de consentement/sécurité.

## Assumptions and uncertainties

- Les versions exactes de React, de React DOM et de l'outillage DOM de test ne
  sont pas figées dans ce plan. Elles seront résolues pendant `apply` avec des
  installations `--save-exact`, puis contrôlées dans `package.json` et le
  lockfile. Aucun `^` ni `~` ne sera accepté, et Node 22 doit rester le moteur
  déclaré.
- La fixture React et ses tests restent hors du build de production. Le build
  peut donc ne pas embarquer React tant que TS-059 n'importe pas la surface
  réelle ; l'écart de taille mesuré portera sur les modules de frontière et
  d'adaptateur, et la compilation JSX sera prouvée par un test de transformation
  déterministe. Ce choix évite de charger du code React inutilisé.
- Le problème de compatibilité de test Node/React DOM est résolu par un DOM
  synthétique déterministe (outillage DOM épinglé) et une compilation JSX
  explicite ; ce n'est pas une preuve de navigateur réel, de focus réel, de
  tactile ou de lecteur d'écran.
- La spécification canonique `static-build-pipeline` contient encore une
  exigence « Publication Pages inchangée » rédigée avant ASF-WF-004, alors que
  la publication effective sert désormais `dist/`. Ce changement ne modifie pas
  ce texte canonique, ne touche pas aux workflows et ne dépend pas de cette
  réécriture. L'écart doit être rappelé en revue post-sync pour ne pas conclure à
  tort que `site/` est encore publié.
- L'interface exacte de l'adaptateur sera affinée par les tests de comportement
  de TS-059. Ce plan fixe le contrat observable (lecture seule, commandes
  nommées, invalidation, aucune écriture implicite) sans inventer les composants
  métier futurs.
