# Simulation dry-run du scheduler (ASF-V2-005)

**Statut :** implémentation présente dans la PR de la tâche, **non fusionnée** et
**non vérifiée par une CI GitHub indépendante**. Preuves locales uniquement.
**Spécification normative :** [Scheduler V1](specs/scheduler-v1.md) (ASF-SCH-001), §7.
**Dépendance :** [noyau pur du scheduler](scheduler-core.md) (ASF-V2-004).
**Tâche :** [ASF-V2-005](tasks/ASF-V2-005.md).

## Objet

Offrir une commande d'inspection du choix du scheduler **sans aucun effet** :
aucun appel OpenRouter, aucune écriture GitHub, aucune réservation de quota,
aucun dispatch, aucune écriture de journal. La simulation réutilise le noyau
pur, donc la décision affichée est **celle du vrai scheduler**, pas une
réimplémentation.

## Fichiers

- `scripts/asf/scheduler/dry-run.mjs` : CLI et constructeur de rapport pur.
- `scripts/asf/scheduler/fixtures.mjs` : scénarios déterministes non payants.
- `tests/asf-scheduler-dry-run.test.mjs` : 16 tests déterministes.

## Utilisation

```text
node scripts/asf/scheduler/dry-run.mjs dry-run --fixture dependency-pending --format human
node scripts/asf/scheduler/dry-run.mjs dry-run --fixture empty --format json
node scripts/asf/scheduler/dry-run.mjs dry-run --backlog . --format json
node scripts/asf/scheduler/dry-run.mjs dry-run --backlog . --evidence evidence.json --format json
```

| Option | Rôle |
| --- | --- |
| `--fixture <nom>` | Scénario intégré (`empty`, `priority`, `dependency-verified`, `dependency-unknown`, `dependency-pending`, `delivered-not-archived`). |
| `--backlog <dir>` | Construit l'instantané via ASF-V2-002 (`buildBacklogIndex`), lecture seule. |
| `--evidence <fichier>` | Preuves explicites au format `{ deliveries, conflicts, assumptions?, observedAt? }`. |
| `--max-tasks 1..2` | Plafond de la vague (`limits.maxTaskStarts`), défaut `1`. |
| `--format json\|human` | Sortie machine ou résumé français. |
| `--observed-at <iso>` | Horodatage injecté par l'adaptateur ; jamais calculé par la simulation. |

`--fixture` et `--backlog` sont exclusifs.

## Preuves : vérifiées, inconnues ou hypothétiques

La simulation ne présume jamais qu'une dépendance est livrée :

- **`verified`** : preuve explicite fournie (`status: "verified"` avec `proof`).
- **`unknown`** : état GitHub indisponible → `STOP_UNCERTAIN` avant tout paiement.
- **`not_observed`** : aucune preuve → une dépendance est traitée comme non
  livrée (blocage sûr), jamais comme libre.
- **`assumptions`** : livraisons **futures hypothétiques**. Elles ne servent
  qu'à calculer une **projection** distincte, marquée `hypothetical: true` et
  accompagnée de la note « une projection n'est pas une preuve de livraison ».
  La décision réelle n'en dépend jamais.

En mode `--backlog` sans `--evidence`, l'état GitHub est considéré indisponible.
Si des candidates sont actionnables, la décision est `STOP_UNCERTAIN`. Un
backlog vide reste `NO_WORK` avec zéro dispatch : il n'y a rien à vérifier.

## Sortie

Le rapport JSON expose : `mode`, `policyVersion`, `maxTasks`, `dispatchCount`
(toujours `0`), `writesJournal` (toujours `false`), les `candidates` (priorité,
`created_at`, `depends_on`, hash, `delivery`, `conflict`, éligibilité et motifs),
les `excludedCandidates` hors politique, la `decision` complète (motifs,
exclusions, références de preuves), l'`order` potentiel, le résumé `evidence`
(vérifiées / inconnues / conflits / hypothèses), la `projection` éventuelle et
des `notes`. La sortie humaine reprend ces éléments en français.

## Critères d'acceptation et validation locale

- **Backlog vide ⇒ `NO_WORK`, zéro dispatch.** Fixture `empty` :
  `decision = NO_WORK`, `dispatchCount = 0`, `candidates = []`.
- **Des fixtures avec dépendances expliquent les mêmes décisions que le cœur.**
  Chaque fixture compare la décision du rapport à un appel direct à
  `selectNextTask` construit à partir de `buildWaveCandidates` : décision et
  `taskId` identiques.
- **Aucune écriture de journal, API payante ni OpenRouter ; `npm run check`
  passe.** Test statique interdisant écritures, réseau, `child_process`,
  `fetch`, `Math.random`, `new Date` et toute référence OpenRouter dans
  `dry-run.mjs` et `fixtures.mjs`. `dispatchCount = 0` et
  `writesJournal = false` sont vérifiés sur chaque fixture.

Validation exécutée localement sur la branche de la tâche :

- `node --test tests/asf-scheduler-dry-run.test.mjs` → **16 tests réussis**.
- `npm run check` → voir la fiche de tâche pour le décompte exact.

## Limites et éléments non revendiqués

- **Non revendiqué** : CI GitHub indépendante sur le bon SHA, fusion,
  vérification post-fusion sur `main`, adaptateur GitHub réel (ASF-V2-007),
  journal durable et quotas persistants (ASF-V2-006) ou workflow de vague
  (ASF-V2-008/009). Aucun appel OpenRouter payant.
- Le mode `--backlog` lit les fichiers de tâches via ASF-V2-002 ; il ne lit pas
  l'état GitHub et ne remplace pas l'adaptateur de preuves.
- `--max-tasks` est borné à `1..2` pour rester cohérent avec la V1 ; la
  simulation ne réserve ni ne consomme de quota.
