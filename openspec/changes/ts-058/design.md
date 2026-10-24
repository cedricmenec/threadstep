# Design

## Context

Voir `proposal.md` — Why et `specs/react-integration-boundary/spec.md` pour les
comportements attendus.

L'état livré est une application vanilla dont `site/app.js` possède le DOM, les
événements, l'état de présentation et l'appel à la persistance. `render()`
reconstruit les descendants de `#subjects` via `replaceChildren`, y compris le
détail d'un projet. Les règles pures et les identifiants stables sont déjà dans
`site/core.js` ; Dexie, l'OTP, la synchronisation et l'isolation des espaces
restent des modules séparés. La continuité focus/scroll est portée par
`site/interaction-continuity.js` et les fonctions de capture/restauration de
`app.js`. TS-059 remplacera uniquement le rendu du détail d'un projet ; ce plan
doit donc rendre la coexistence impossible à confondre avant même le pilote.

TS-057 a introduit Vite 7.3.7, la base `/threadstep/`, `dist/` et la CSP de
production stricte. ASF-WF-004 publie désormais `dist/`. Aucun fichier de
workflow ne doit être modifié ici.

## Goals / Non-Goals

**Goals:**

- Rendre React installable, compilable localement et testable sans l'activer
  dans l'interface publiée.
- Garantir qu'au plus une racine React possède un conteneur borné, et que le
  renderer vanilla ne peut pas écrire dans ce conteneur tant que la racine est
  active.
- Fournir un adaptateur étroit, en lecture seule, sans store parallèle, dont les
  intentions passent par les commandes existantes et le flux d'écriture existant.
- Invalider toute présentation dont la route, l'identité autorisée ou la
  disponibilité des données a changé.
- Prouver ces invariants par des tests déterministes exécutables sur le runner
  avant OPSX sync, et documenter ce qui reste une recette humaine.

**Non-Goals:**

- Monter une surface React métier en production, modifier le rendu, les styles,
  le comportement, les routes ou les données de l'application livrée.
- Extraire ou réécrire `site/app.js`, `site/core.js`, Dexie, l'OTP, la sauvegarde,
  l'import/fusion, la restauration, le consentement ou la récupération.
- Ajouter un routeur React, un state manager, Tailwind, un design system ou une
  seconde base.
- Changer la CSP de production, les workflows, la publication ou les secrets.

## Decisions

### 1. Une nouvelle capacité dédiée, sans réécrire les specs existantes

`react-integration-boundary` porte uniquement le contrat du socle
d'intégration : outillage, propriété DOM, adaptateur, invalidation, réversibilité
et vérification. Les capacités `app-navigation`, `ux-interaction-continuity`,
`workspace-identity-isolation`, `frontend-security-boundary`,
`static-build-pipeline`, `subject-detail-view` et Cloud/OTP restent les sources
de vérité de leurs comportements respectifs.

*Alternative écartée :* modifier chaque spec métier pour y ajouter React
créerait des doublons et laisserait croire à un changement fonctionnel ou à une
migration déjà réalisée.

### 2. React épinglé, JSX local automatique, CSP inchangée

`react` et `react-dom` sont ajoutés comme dépendances d'exécution à versions
exactes, résolues pendant `apply` avec `npm install --save-exact`, puis figées
dans `package.json` et `package-lock.json`. Un outillage DOM de test (par
exemple `jsdom`) est ajouté uniquement en `devDependencies`, également épinglé.
`npm ci` doit installer exactement ces versions.

`vite.config.mjs` déclare `esbuild.jsx = "automatic"` pour que les fichiers
`.jsx` utilisent le runtime JSX automatique de React, sans Babel, sans plugin
supplémentaire et sans transformation runtime. La production conserve
`script-src 'self'`, sans `unsafe-inline`, `unsafe-eval`, CDN ni script inline.
Le build reste statique et sous `/threadstep/`.

*Alternatives écartées :* Babel ajouterait une chaîne de compilation et des
dépendances inutiles ; un runtime JSX global ou un script inline violerait la
CSP ; un CDN introduirait une ressource réseau tierce et un risque de
disponibilité.

### 3. Frontière DOM explicite et unique

Un module pur `site/react-boundary.js` (sans import React ni Dexie) décrit
l'état de propriété :

- un seul emplacement actif à la fois, identifié par une clé comprenant la vue,
  l'identifiant de projet et la génération d'identité autorisée ;
- `mount`/`acquire` est idempotent pour la même clé et refuse un second
  propriétaire ;
- `release`/`unmount` rend la propriété au vanilla et détruit la racine ;
- `invalidate` démonte la racine puis marque le contexte comme invalidé ;
- `canWriteVanilla(container)` est faux tant que la racine possède le conteneur.

`site/app.js` appelle ce garde-fou avant de remplacer `#subjects` et avant tout
retour au rendu vanilla. Il libère explicitement la surface sur changement de
route, changement d'identité autorisée, chargement bloquant ou lecture non
disponible. Aucun listener global n'est ajouté par la surface : les listeners
React restent dans l'arbre monté et disparaissent au démontage. Les tests
comptent les abonnements et vérifient qu'aucun n'est dupliqué après plusieurs
cycles montage → navigation → rafraîchissement → démontage.

*Alternatives écartées :* laisser `render()` remplacer les descendants et
« recréer » React à chaque passage créerait deux propriétaires DOM et des
listeners orphelins ; monter React dans `body` ou dans un portail hors du
sous-arbre rendrait la frontière de données et de focus impossible à auditer.

### 4. Adaptateur de présentation en lecture seule et à commandes explicites

Un module pur `site/react-adapter.js` définit une fabrique recevant des
dépendances explicites du contrôleur existant :

- `getDocument`, `getRoute`, `getTransientState`, `getAuthorizedIdentity`,
  `isBusinessAllowed`, `isLoadingBlocked` ;
- des commandes nommées et limitées, par exemple `renameSubject`, `createItem`,
  `updateItem`, `toggleItem`, `removeItem`, `reorderItem`, `promoteItem`,
  `toggleSubsteps`, `openItemMenu`, `closeItemMenu`, `trackItem` et
  `returnToOverview`. Chaque commande est un callback vers le contrôleur
  existant ; elle ne contient aucune règle métier dupliquée et n'écrit pas
  elle-même dans Dexie.
- `subscribe(listener)` pour notifier un rafraîchissement autorisé et
  `invalidate(reason)` pour rendre l'instantané indisponible.

`getSnapshot()` produit un objet détaché et figé (`Object.freeze`, copies des
tableaux) contenant les données métier utiles, les compteurs calculés par
`core.js`, les identifiants stables et un sous-objet `transient` distinct
(éditeur/brouillon, menu ouvert, parents développés, filtre courant). Une
tentative de mutation de l'instantané échoue ou reste sans effet sur le
document. Le rafraîchissement recrée l'instantané à partir du document courant
sans réinitialiser les états transitoires encore valides.

*Alternatives écartées :* passer directement `documentState` exposerait un
objet mutable et créerait une seconde source de vérité ; laisser React
s'abonner à Dexie ou à l'OTP dupliquerait le cycle de vie et les frontières de
confiance ; déplacer les mutations dans l'adaptateur reviendrait à extraire le
métier du contrôleur.

### 5. Invalidation aux frontières explicites

L'instantané est invalidé et l'ancien contenu n'est plus visible lorsque :

- la route change de vue ou d'identifiant de projet ;
- l'identité autorisée change (espace local/synchronisé, base, empreinte de
  compte) ou `businessAllowed()` devient faux ;
- une lecture ou un chargement bloquant rend les données indisponibles ;
- le projet n'existe plus après import, restauration ou rafraîchissement ;
- la surface est démontée volontairement.

Un simple rafraîchissement de données autorisé ne suit pas ce chemin : il
notifie et conserve les états transitoires valides. La navigation explicite,
le rechargement, le changement de compte/espace et les transitions de sécurité
restent les exceptions de réinitialisation déjà définies par
`ux-interaction-continuity`, `app-navigation` et
`workspace-identity-isolation`.

### 6. Fixture synthétique et tests déterministes sans production

Aucune surface React métier n'est montée par `site/app.js` dans ce changement.
Une fixture de test synthétique (projet et tâches fictifs, aucun accès à la
persistance) est compilée avec la même configuration JSX que Vite, puis montée
dans un DOM déterministe fourni par l'outillage de test épinglé. Les tests
utilisent les API React de montage/démontage et vérifient :

- montage, démontage et remontage répétés sans enfant résiduel ;
- absence de deux propriétaires DOM pour un descendant ;
- absence de listener actif dupliqué après navigation et rafraîchissement
  simulés ;
- instantané non mutable et identifiants stables ;
- routage des intentions vers les callbacks nommés ;
- aucune écriture IndexedDB/Dexie ni requête Cloud au montage, au rendu, au
  démontage ou sur une préférence visuelle ;
- invalidation sur route, identité, chargement bloquant et donnée disparue ;
- conservation des routes et fragments existants.

Les tests ne prouvent ni un rendu visuel réel, ni le focus navigateur, ni le
tactile, ni un lecteur d'écran. Ces dimensions restent en recette manuelle.

*Alternative écartée :* activer React sur le détail réel pour tester aurait
mélangé le socle et le pilote TS-059, et aurait exposé prématurément les données
et les interactions de production à une seconde logique de rendu.

### 7. Build et taille : React dormant, écart mesuré et documenté

Tant que TS-059 n'importe pas de composant React réel, le build de production
n'embarque pas nécessairement React : seuls les modules de frontière et
d'adaptateur sont ajoutés. La compilation JSX est néanmoins prouvée par le test
qui transforme la fixture avec les options du projet. L'écart de taille du build
est mesuré avant/après et documenté ; l'ajout du chunk React sera mesuré à
nouveau lors du pilote. Le build doit rester statique, sans requête réseau
implicite, sans CDN et avec la CSP de production identique à `site/index.html`.

*Alternative écartée :* ajouter artificiellement un chunk React inutilisé au
bundle publié serait un coût sans usage et brouillerait la mesure du pilote.

### 8. Réversibilité et documentation

La bascule est un simple retour au rendu vanilla : ne pas monter la surface,
ou la démonter avant `render()`. Aucune préférence persistée, nouvelle route,
clé de stockage ou migration n'est créée. La documentation couvre les fichiers
concernés, le contrat de propriété, l'adaptateur, le JSX, la CSP, les limites de
test, le diagnostic d'un conteneur vide ou d'un conteneur remplacé par erreur,
l'écart de taille et la procédure de retour arrière. La publication Pages reste
inchangée par ce changement.

## Risks / Trade-offs

- **Un conteneur React remplacé par le vanilla pendant un rendu** → garde-fou
  unique dans le chemin de remplacement, clé de propriété vérifiée avant chaque
  écriture, test de non-régression sur les cycles navigation/rafraîchissement.
- **Listeners ou abonnements cumulés après plusieurs montages** → aucun listener
  global dans la surface, démontage explicite, compteur de listeners dans la
  fixture, test de cycles répétés.
- **Adaptateur trop large ou devenant un second store** → liste fermée de
  commandes, instantané détaché, absence d'import Dexie/OTP, test statique et
  test d'écriture nulle.
- **Instantané périmé affiché après changement de route, de compte ou de
  chargement** → invalidation générationnelle et vérification de la clé de
  contexte avant notification, test de l'invisibilité des données précédentes.
- **Réinitialisation abusive de l'état transitoire lors d'un simple
  rafraîchissement** → séparation explicite `snapshot`/`transient`, notification
  sans remontage, scénarios de continuité.
- **Divergence entre le DOM de test et un vrai navigateur** → documentation
  explicite des limites, recette manuelle desktop/Chrome Android, aucune
  affirmation d'accessibilité réelle à partir des tests Node.
- **CSP ou JSX dégradant le build** → runtime automatique sans `eval`, test de la
  CSP construite et de la transformation JSX, `verify:build` existant conservé.
- **Écart de spec sur Pages** → la spec canonique `static-build-pipeline` décrit
  encore une publication `site/` antérieure à ASF-WF-004 ; ce changement ne la
  réécrit pas, ne touche pas aux workflows et documente l'état effectif `dist/`.

## Migration Plan

1. Résoudre et figer les versions exactes de React, React DOM et de l'outillage
   DOM de test ; mettre à jour package et lockfile.
2. Ajouter le traitement JSX automatique à Vite et les tests statiques de
   dépendances, JSX, CSP et build.
3. Ajouter les modules de frontière DOM et d'adaptateur, puis le garde-fou
   minimal dans `app.js` et les tests de propriété, de listeners et
   d'invalidation.
4. Ajouter la fixture synthétique React et les tests d'intégration déterministes.
5. Documenter la frontière, le diagnostic, l'écart de taille et le retour
   arrière.
6. Exécuter `npm ci`, les tests ciblés, `npm run check`, `npm run build`,
   `npm run verify:build`, `npm run verify:servers`, puis les validations
   OpenSpec.
7. Aucun changement de données, de schéma, de route, de configuration Cloud ou
   de workflow. Retour arrière : ne pas importer/monter la surface React,
   conserver les modules de frontière dormants ou les retirer, puis reconstruire
   et republier avec la CI normale. Aucune base locale ni export n'est affecté.

## Open Questions

Aucune question bloquante pour les specs, l'approche ou le découpage. La version
exacte des dépendances et l'interface détaillée des composants TS-059 restent
volontairement résolues à l'implémentation, sans changer le contrat observable.
