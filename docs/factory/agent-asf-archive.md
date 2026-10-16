# Archiveur déterministe et PR documentaire (ASF-V2-010)

**Statut : implémenté dans la PR d'ASF-V2-010, non encore fusionné ni vérifié
sur `main`.** Ce document décrit le comportement réel de l'archiveur introduit
par [ASF-V2-010](tasks/ASF-V2-010.md) pour les références normatives
[Backlog V2](specs/backlog-v2.md) (§4.3, §4.4, §5) et
[Orchestrator V1](specs/orchestrator-v1.md) (§9). Il complète
[l'index déterministe](backlog-v2-index.md) (ASF-V2-002), la
[migration historique](backlog-v2-migration.md) (ASF-V2-003) et
[la vérification des livraisons](delivery-verification.md) (ASF-V2-007).

## 1. Objet et limites

- Archiver **uniquement** les tâches dont la livraison a déjà été
  indépendamment vérifiée (`verified`) par l'adaptateur GitHub en lecture seule
  (ASF-V2-007). L'archiveur ne décide jamais lui-même qu'une tâche est livrée.
- Déplacer le fichier de tâche de `backlog/tasks/` vers `backlog/archive/` en
  **préservant le corps Markdown** et **sans cocher rétroactivement** les cases
  d'acceptation historiques ; seule une métadonnée de livraison sans secret est
  ajoutée au frontmatter.
- Regrouper toutes les livraisons vérifiées d'une portée dans **une seule PR
  documentaire**. Zéro livraison vérifiée ⇒ **aucune PR** et **aucun
  déplacement**.
- Enregistrer `archive_pending` lorsqu'une livraison vérifiée n'a pas pu être
  archivée (PR ouverte, échouée ou ambiguë) ; cet état **ne rend jamais** la
  tâche réexécutable.
- **Hors périmètre :** aucune fusion sans autorisation applicable, aucun appel
  OpenRouter, aucune modification de `site/`, des workflows, des secrets ou des
  règles GitHub. La recette E2E réelle relève d'[ASF-V2-011](tasks/ASF-V2-011.md).

## 2. Séparation des rôles

```text
vérification de livraison (ASF-V2-007, lecture seule)
        | verdicts verified / pending / unknown
        v
scripts/asf/archive/core.mjs        # noyau pur, déterministe, sans I/O
        | plan d'archive (déplacements, liens, PR unique ou null)
        v
scripts/asf/archive/apply.mjs       # application fichiers + régénération index
        |
        v
branche documentaire asf/archive/<slug> + PR via GitHub App
        | CI indépendante `check` + Protect Main
        v
scripts/request-safe-auto-merge.mjs archive   # garde de fusion, inchangé sur le fond
```

Le noyau (`core.mjs`) est **pur** : aucune horloge, aucun réseau, aucune
écriture, aucune mutation d'entrée. L'adaptateur fichiers (`apply.mjs`) est le
seul point qui touche l'arbre de travail et ne fait ni Git, ni GitHub, ni
réseau.

## 3. Décision d'archivage

- `selectArchivable(deliveries)` ne retient que les verdicts de statut
  exactement `verified` dont la preuve est complète (`pr` entier positif,
  `head_sha`/`merge_sha` hexadécimaux) et **unique**. Tout autre verdict est
  bloqué avec un motif explicite :
  `delivery_pending`, `delivery_failed`, `delivery_unknown`,
  `delivery_invalid`, `delivery_missing`, `duplicate_delivery`, `task_missing`.
- Outre le verdict vérifié, la carte de tâche active correspondante doit
  exister. Une livraison vérifiée sans carte active est bloquée, jamais archivée.
- L'ordre des déplacements est stable (tri par identifiant), ce qui rend le plan
  **reproductible octet pour octet** à entrées égales.

## 4. Contenu archivé

- `renderArchivedTask` réinsère le corps d'origine **verbatim** (cases
  historiques `[ ]`/`[x]` inchangées) et ajoute un bloc imbriqué `delivery:`
  avant la fin du frontmatter, dans un ordre de champs déterministe :
  `head_sha`, `merge_sha`, `pull_request`, `pull_request_url`, `verified`.
- Le rendu est **idempotent** : réappliquer l'archiveur à un fichier déjà
  archivé ne crée pas de second bloc `delivery:`.
- La métadonnée alimente `backlog/archive-index.json` via le générateur
  existant (ASF-V2-002) ; la présence dans `backlog/archive/` **ne prouve
  jamais** une livraison par elle-même.

## 5. PR documentaire unique

- `buildArchivePlan` produit `pullRequest: null` si et seulement si aucun
  déplacement n'est retenu. Sinon il produit **une** PR : base `main`, branche
  `asf/archive/<slug>` (slug normalisé déterministe), titre et corps listant les
  tâches et SHA de fusion, sans secret.
- `evaluateArchiveOutcome` traduit l'état de la PR :
  `merged` ⇒ chaque déplacement est `archived` ; `open`, `failed` ou `unknown`
  ⇒ chaque déplacement est `archive_pending` avec un motif (`pull_request_open`,
  `pull_request_failed`, `pull_request_unknown`).
- `toExecutionEvidence` projette les seules livraisons **vérifiées** en preuve
  `verified` pour le scheduler, indépendamment du sort de la PR. Une tâche en
  `archive_pending` reste donc vue comme déjà livrée et n'est **jamais**
  redispatchée : l'archivage est une localisation documentaire, pas un état
  d'exécution.

## 6. Application fichiers

`applyArchivePlan({ root, plan, documents })` :

1. refuse un plan absent ou non valide (fermeture par défaut) ;
2. ne fait **rien** sans PR (plan vide) ;
3. déplace chaque tâche planifiée, en échouant si la source manque ou si la
   destination existe déjà (pas d'écrasement) ;
4. réécrit uniquement les liens `backlog/tasks/<id>.md` des documents
   explicitement fournis ;
5. régénère `backlog/index.json` et `backlog/archive-index.json` et échoue si le
   générateur signale une divergence.

## 7. Garde de fusion native

- Les familles de branches restent **séparées** :
  `agent/(openspec/)?TS-NNN` pour les agents de développement (inchangé) et
  `asf/archive/<slug>` pour l'archiveur. Aucune n'élargit l'autre.
- `runArchiveAutoMerge()` (entrée `ASF_ARCHIVE_BRANCH`) applique **exactement**
  les mêmes prérequis que la voie agent : `Protect Main` actif, `pull_request`,
  statut `check` requis, PR ouverte non-brouillon sur `main` au SHA poussé, et
  `--match-head-commit`. Aucun `--admin`, aucun contournement.

## 8. Vérification et limites

- Couvert par `tests/asf-archive.test.mjs` (17 tests) : PR unique vs aucune PR,
  archivage de la première livraison malgré l'échec de la seconde,
  `archive_pending` non réexécutable, préservation du corps et des cases,
  idempotence, réécriture de liens, fermeture par défaut, application fichiers
  (déplacement + index + liens) et garde de fusion inchangé.
- `npm run check` a été exécuté localement sur la branche de cette PR :
  `npm test` → 265 tests réussis, puis `backlog:check` (11 actifs, 0 archivé),
  puis `node --check site/core.js` et `node --check site/app.js` (aucun workflow
  modifié, donc Actionlint non requis).
- **Non revendiqué :** CI GitHub indépendante sur le SHA de la PR, fusion,
  vérification post-fusion sur `main`, création réelle de PR documentaire via
  GitHub App, réconciliation des livraisons manuelles et recette E2E
  (ASF-V2-011). Aucun appel OpenRouter payant n'a été effectué pour cette tâche.
