# Proposal

## Why

TS-064 a livré les cartes Overview en React et réutilise déjà les éditeurs et
commandes du détail projet. Il reste toutefois à qualifier explicitement ces
interactions, à remplacer la présentation impérative du glisser-déposer qui
modifie encore des nœuds possédés par React, et à prouver qu'une intention
utilisateur ne produit qu'une mutation déléguée au contrôleur historique. Sans
ce lot, la frontière React/vanilla reste ambiguë pour les commandes de carte et
les futurs travaux visuels de TS-066.

## What Changes

- Qualifier la surface React bornée des cartes Overview comme propriétaire des
  éditeurs et commandes existants : création, édition, validation, annulation,
  priorité, complétion, menu, sous-étapes, retrait/annulation, déplacement et
  suivi. Les mutations restent déléguées au contrôleur historique et à
  `site/core.js` ; aucune règle métier n'est recopiée dans React.
- Faire passer la **présentation** du glisser-déposer Overview (poignée, cible,
  indicateur de dépôt, annulation) à un état React local à la surface. Un dépôt
  valide émet exactement une commande de réordonnancement et une écriture ; un
  dépôt invalide, `Échap` ou `pointercancel` n'écrit rien. Le glisser-déposer
  du détail projet conserve son comportement actuel.
- Ajouter des tests déterministes sur données synthétiques pour l'unicité des
  commandes et écritures, les validations et annulations d'éditeur, la
  continuité des brouillons/focus/scroll, la suspension sous filtre et
  l'isolation aux frontières de route, d'identité, d'espace et de lecture
  bloquée.
- Documenter la propriété des interactions, les commandes déléguées, le
  diagnostic, les preuves automatisées et les limites de recette humaine.
- Ne modifier ni route, ni clé de stockage, ni dépendance, ni schéma Dexie, ni
  OTP, ni consentement, ni sauvegarde/restauration, ni configuration Cloud.

## Capabilities

### New Capabilities

- `react-overview-interactions` : comportement observable des commandes et
  éditeurs de la surface React Overview — une intention produit au plus une
  mutation déléguée, continuité de saisie/focus/scroll, glisser-déposer
  présentationnel avec mutation unique, isolation des contextes bloqués et
  vérification déterministe sans remplacer les règles canoniques existantes.

### Modified Capabilities

Aucune exigence produit existante n'est modifiée. Les capacités
`action-editing`, `action-note`, `action-removal`, `action-ordering`,
`task-actions-menu`, `substep-collapse`, `substep-promotion`,
`overview-project-read-state` et `ux-interaction-continuity` restent les
contrats de référence et ne reçoivent pas de delta.

## Impact

- `site/overview/` : état de glisser-déposer de présentation et câblage des
  commandes existantes ; réutilisation de `TaskItem`, `TaskEditor`,
  `TaskActionMenu`, `CreateTaskForm` et des primitives `site/ui/`.
- `site/app.js` : branchement borné de la session de glisser-déposer Overview
  vers les commandes existantes ; conservation de `parseRoute`, `hashchange`,
  `navigate`, `openSubject`, `applyFocus` et `finishUxRender`.
- `site/project-detail/TaskItem.jsx` : prop optionnelle de session de drag
  pour ne pas changer le comportement du détail alors que la carte Overview
  fournit sa propre session.
- `tests/ts-065-*.test.mjs` et documentation
  `docs/product/react-overview-interactions.md` + `docs/product/developer-guide.md`.
- Aucun changement de `site/core.js`, `site/react-boundary.js`,
  `site/react-adapter.js`, `package.json`, `package-lock.json`, `AGENTS.md`,
  workflow, `backlog/`, schéma Dexie, routes, CSP ou formats d'import/export.

## Non-goals

- Migrer les zones globales restées vanilla de TS-064 : filtres, compteur
  global, suggestion, carte « Je reprends ici », zone « Urgences à traiter »,
  chargement, formulaire de projet et pages de paramètres.
- Ajouter une nouvelle fonction de recherche, de partage, d'archivage, de
  statistique ou de navigation, ou modifier un libellé, une validation ou une
  règle métier existante.
- Modifier le glisser-déposer du détail projet, le schéma Dexie, l'identité
  d'espace, l'OTP, le consentement, la sauvegarde ou la restauration.
- Appliquer une composition visuelle Stitch ou Tailwind ; cela reste TS-066.
- Présenter un test jsdom, une CI verte ou une capture comme une preuve de
  navigateur réel, de clavier physique, de tactile, de lecteur d'écran ou
  d'accessibilité perçue.

## Uncertainties and decisions to confirm

- **Porte de dépendance TS-064.** L'archive et la fusion TS-064 sont présentes
  dans le dépôt, mais aucune preuve `PASS` par scénario de la recette humaine
  desktop/Android n'est versionnée. `apply` doit vérifier cette trace et
  s'arrêter si elle manque ; il ne doit pas convertir une déclaration humaine
  en preuve automatisée.
- **Périmètre des « commandes et éditeurs ».** TS-064 a déjà migré les
  éditeurs et commandes internes aux cartes via les composants partagés. Le
  plan retient donc une qualification avec fermeture du seul écart
  d'interaction impérative restant, le drag Overview. Si le propriétaire attend
  aussi la migration des zones globales vanilla ou du drag du détail, la
  découpe doit être confirmée avant `apply` ou scindée.
- **Recette physique TS-065.** La recette desktop et Chrome Android reste
  obligatoire pour l'acceptation humaine. Aucun résultat n'est revendiqué par
  ce plan.
- **Décision produit non inventée.** Les libellés, limites, priorités,
  validations, confirmations et annulations restent ceux des spécifications
  canoniques et du code livré.
