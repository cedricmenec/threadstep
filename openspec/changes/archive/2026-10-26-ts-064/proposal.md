# Proposal

## Why

Après le pilote du détail projet (TS-059/TS-060) et la coque d'en-tête
(TS-063), la liste des cartes projet d'Overview reste le dernier grand
sous-arbre métier rendu par le contrôleur vanilla. TS-064 doit la faire
passer à une présentation React bornée, à comportement strictement constant,
pour réduire la double maintenance DOM avant les travaux ultérieurs
d'interactions et de composition visuelle. Le risque principal est la
propriété DOM de `#subjects`, la continuité focus/scroll et l'absence de
double commande pendant le montage.

## What Changes

- Introduire une surface React bornée pour la **liste des cartes projet de
  `#/`** dans `#subjects`, avec les mêmes classes, identifiants, libellés,
  ordre et contrôles que le rendu livré. La surface ne possède que cette
  liste ; les filtres, le compteur global, la suggestion, la reprise, la zone
  « Urgences à traiter », les états de lecture, le formulaire de projet et
  toutes les pages de paramètres restent vanilla.
- Réutiliser les composants React déjà qualifiés du détail projet et les
  primitives TS-061 pour les lignes de tâches, les éditeurs et le formulaire
  d'ajout existants, sans ajouter ni modifier de règle de validation ou de
  commande métier.
- Conserver exactement les compteurs de carte, la progression textuelle, les
  urgences restantes, l'aperçu de cinq tâches parentes visibles, les
  sous-tâches hors quota, l'unique commande « Voir plus », l'ordre enregistré,
  le filtre de projets, l'état vide et le repli vers `#/sujet/<id>`.
- Déléguer chaque intention utilisateur au contrôleur existant, avec au plus
  une commande et une écriture par intention. Le montage, les mises à jour,
  les changements de filtre et le démontage ne doivent produire aucune
  écriture IndexedDB/`localStorage`, requête Cloud, OTP, migration ou
  commande métier.
- Faire de `#subjects` un conteneur à propriétaire unique : coque, détail
  React et cartes Overview restent des surfaces distinctes ; Overview et
  détail ne sont jamais actifs simultanément. L'ancienne surface est libérée
  avant toute réécriture vanilla, tout changement de route, d'identité ou
  d'état bloquant.
- Préserver, pendant les rafraîchissements et mutations de la même vue, le
  focus pertinent, l'ancrage de scroll, les parents développés, les brouillons
  et le filtre. Réinitialiser à une vraie entrée de vue, un rechargement, un
  import/restauration ou un changement d'identité, selon
  `ux-interaction-continuity`.
- Ajouter des tests déterministes de rendu, comptage, aperçu, commandes,
  cycles de frontière, continuité, accessibilité automatisable, largeurs
  structurelles et absence d'effet métier ; conserver les preuves
  `npm run check`, `npm run build` et `npm run verify:build`.
- Documenter la carte de propriété, les points de montage, les frontières,
  le diagnostic et le retour arrière. Aucun changement de règle métier, de
  route, de stockage, de dépendance, de CSP ou de configuration Cloud.

## Capabilities

### New Capabilities

- `react-overview-cards` : surface React bornée de la liste des cartes projet
  d'Overview, parité des données et compteurs, aperçu de cinq parents,
  commandes uniques, continuité focus/scroll/états éphémères et absence
  d'effet métier implicite.

### Modified Capabilities

- `react-integration-boundary` : autoriser une surface de contenu Overview
  dans `#subjects` en plus de la coque et du détail, avec un propriétaire
  unique à la fois, une exclusivité Overview/détail et une invalidation
  indépendante aux frontières de route, d'identité et de blocage.

## Impact

- Nouveaux modules sous `site/overview/` pour l'adaptateur, la surface, les
  cartes projet et la liste d'aperçu ; réutilisation des composants
  `site/project-detail/` et `site/ui/` existants.
- `site/app.js` : brancher la surface Overview sur `#subjects`, les commandes
  et l'état transitoire existants ; conserver `parseRoute`, `hashchange`,
  `navigate`, `openSubject`, `applyFocus` et `finishUxRender`.
- Extraction éventuelle, sans changement de comportement, du formulaire
  d'ajout de tâche déjà React du détail vers un module partagé si l'Overview
  doit le réutiliser.
- `tests/ts-064-*.test.mjs` et adaptations ciblées des tests Overview liés à
  l'ancien `renderSubject`/`renderTaskArea` : les assertions de comportement
  sont conservées, seule la cible d'inspection change.
- `docs/product/react-overview-cards.md` et
  `docs/product/developer-guide.md`.
- Aucun changement de `AGENTS.md`, workflow, `opencode.json`, `backlog/`,
  `package.json`, `package-lock.json`, `site/core.js`, `site/react-adapter.js`,
  persistance Dexie, routes publiques, identifiants IndexedDB, CSP ou formats
  d'export/import.

## Non-goals

- Migrer la suggestion, la carte « Je reprends ici », la zone « Urgences à
  traiter », les filtres, le formulaire de création de projet, la recherche,
  les pages de paramètres ou les formulaires Cloud/OTP/import/restauration.
- Ajouter ou modifier une interaction métier, un éditeur, une validation, une
  statistique, une route, un tri, une préférence persistée ou une clé de
  stockage. TS-065 reste le lot distinct de qualification des interactions et
  éditeurs ; TS-066 reste le lot visuel Stitch.
- Appliquer une nouvelle composition visuelle, Tailwind, une sidebar, un
  tiroir ou une référence Stitch non approuvée. Le rendu reste à parité.
- Modifier Dexie, l'identité d'espace, l'OTP, le consentement, la sauvegarde,
  la restauration, les workflows ou la politique de sécurité.
- Présenter un test jsdom, une CI verte ou une capture structurelle comme une
  preuve réelle de navigateur, de clavier, de tactile, de lecteur d'écran ou
  d'accessibilité.

## Uncertainties and decisions to confirm

- **Porte de dépendance TS-063.** Le backlog indique que TS-063 est fusionnée
  et que le propriétaire a déclaré sa recette validée le 25 octobre 2026.
  Aucune preuve `PASS` par scénario n'est fournie dans le dépôt. Le plan
  vérifie l'archive et l'ascendance Git, mais ne transforme pas cette
  déclaration en preuve automatisée ni en recette rejouée.
- **Périmètre exact « formulaire de création/édition ».** La fiche TS-064
  exclut ce formulaire, tandis que TS-065 est décrit comme le lot des
  interactions et éditeurs. Comme une frontière DOM exclusive sur
  `#subjects` ne peut pas laisser le formulaire interne des cartes au
  vanilla, le plan retient l'interprétation minimale : les cartes existantes
  réaffichent le formulaire et les éditeurs **déjà React** via les commandes
  existantes, sans nouvelle fonctionnalité ni changement de validation.
  Si le propriétaire veut au contraire exclure ces sous-arbres, il faut
  confirmer la découpe avant `apply` ou scinder le lot.
- **Références visuelles Overview.** Les références M03/M04/M05 ne sont pas
  approuvées. Le plan conserve strictement le markup, les classes et les
  tokens existants ; toute harmonisation visuelle appartient à TS-066.
- **Compteur global.** La formulation « cartes et leurs compteurs » est
  interprétée comme les compteurs internes de carte plus la conservation du
  compteur global vanilla, qui reste calculé par `overviewMetrics` sur le
  document complet. Aucun chiffre global n'est déplacé dans React.
- **Glisser-déposer existant.** Les poignées et commandes de déplacement
  restent déléguées au contrôleur historique, comme dans le détail React.
  Le plan ne change pas ce comportement ; si la revue juge les mutations DOM
  impératives pendant un drag incompatibles avec la propriété exclusive, ce
  sujet doit être traité dans TS-065 plutôt que masqué ici.
- **Aucune décision de produit inventée.** Les textes, libellés français,
  limites, accords et états vides restent ceux des spécifications canoniques
  et du rendu livré.
