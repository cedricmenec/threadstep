# Noyau pur du scheduler (ASF-V2-004)

**Statut :** implémentation présente dans la PR de la tâche, **non fusionnée** et
**non vérifiée par une CI GitHub indépendante**. Preuves locales uniquement.
**Spécification normative :** [Scheduler V1](specs/scheduler-v1.md) (ASF-SCH-001).
**Tâche :** [ASF-V2-004](tasks/ASF-V2-004.md).

## Objet et périmètre

Le noyau répond à une seule question : **quelle tâche d'une vague déjà autorisée
doit démarrer ensuite**. Il est volontairement limité à des fonctions pures :

- entrées injectées : instantané de backlog validé, manifeste de vague figé,
  preuves de livraison/conflit, journal d'exécution ;
- aucune lecture disque, aucun réseau, aucune horloge, aucun appel LLM ;
- aucune mutation des entrées ;
- aucune réservation de quota, aucun dispatch, aucune fusion, aucune écriture.

La CLI `dry-run` (ASF-V2-005), le journal durable et les quotas persistants
(ASF-V2-006) et l'adaptateur GitHub (ASF-V2-007) sont **hors périmètre** ici.

## Fichiers

- `scripts/asf/scheduler/core.mjs` : implémentation du noyau pur.
- `scripts/asf/scheduler/index.mjs` : surface publique réexportée.
- `tests/asf-scheduler-core.test.mjs` : 30 tests déterministes.

## API pure

| Fonction | Signature | Rôle |
| --- | --- | --- |
| `validateBacklog` | `(snapshot) -> ValidationReport` | Revalide la projection compacte : IDs uniques, dépendances connues, absence d'auto-référence, de cycle et présence du hash autorisé. |
| `buildWaveCandidates` | `(snapshot, policy) -> CandidateSet` | Fige à l'ouverture les candidates conformes à la politique (produit / ready / allowed / low), dépendances non livrées incluses. |
| `classifyEligibility` | `(task, snapshot, evidence, policy) -> Verdict` | Verdict pur par tâche avec `reasons` et `exclusions` stables. |
| `selectNextTask` | `(manifest, snapshot, evidence, journal) -> SelectionDecision` | Décision complète : quota, échec, incertitude, divergence, éligibilité, ordre. |
| `explainWave` | `(manifest, snapshot, evidence, journal) -> ReadableReport` | Décision + ordre déterministe des candidates éligibles, sans effet de bord. |

`DEFAULT_POLICY` fixe la politique V1 prudente : `type: product`,
`automation: allowed`, `risk: low`. `DECISION` énumère les verdicts.

### Contrat d'entrées

- **`snapshot`** : `{ active, archive, diagnostics }` où chaque fiche porte
  `id`, `path`, `type`, `status`, `priority`, `automation`, `risk`,
  `depends_on`, `created_at`, `content_sha256` (projection ASF-V2-002).
- **`manifest`** : immuable, avec `candidateTasks: [{ id, sha256 }]`,
  `limits.maxTaskStarts`, et éventuellement `policy`. Le `sha256` est comparé à
  `content_sha256`.
- **`evidence`** : `{ deliveries: { [id]: { status, proof } }, conflicts:
  { [id]: { status } }, ambiguity? }`. Statuts de livraison
  `verified | unknown` ; statuts de conflit `conflict | clear | unknown`. Des
  chaînes abrégées (`"verified"`, `"conflict"`, …) sont acceptées.
- **`journal`** : `{ attempts: [{ taskId, status }], quota: { taskStarts,
  maxTaskStarts }, observedAt? }`. `observedAt` est **fourni par l'adaptateur**,
  jamais calculé dans le noyau.

## Règles d'éligibilité

Une candidate est sélectionnable seulement si, dans le périmètre figé :

1. son `id` appartient au manifeste et `content_sha256` égale le `sha256`
   autorisé ;
2. `type = product`, `status = ready`, `automation = allowed`, `risk = low` ;
3. elle n'est ni déjà livrée (`verified`), ni en conflit ;
4. elle n'a jamais été tentée dans le journal ;
5. toutes ses dépendances directes et transitives sont **prouvées livrées**
   (`verified`), y compris une dépendance livrée hors de la vague ou encore
   présente dans `backlog/tasks/` (l'archivage n'est pas requis).

## Départage

1. priorité `critical > high > normal > low` ;
2. `created_at` croissant (le plus ancien d'abord) ;
3. identifiant canonique croissant (comparaison d'unités de code, jamais
   `localeCompare`).

Le nombre `TS-NNN` n'est jamais une priorité métier.

## Décisions et arrêts fermés

| Décision | Condition |
| --- | --- |
| `QUOTA_REACHED` | `taskStarts >= maxTaskStarts` (évalué en premier). |
| `STOP_FAILED` | au moins une tentative en échec dans le journal. |
| `STOP_UNCERTAIN` | instantané invalide, quota malformé, preuve malformée/ambiguë, statut `unknown`, hash divergent ou candidate du manifeste absente. |
| `SELECT` | au moins une candidate éligible. |
| `WAITING_DEPENDENCIES` | candidates restantes mais bloquées par une dépendance non livrée. |
| `NO_WORK` | plus aucune candidate actionnable (déjà livrée, bloquée, tentée, etc.). |

Toute décision inclut `reason`, `exclusions` (motifs par `id`) et, si fourni,
`observedAt`. `SELECT` ajoute `taskId` et les `references` des preuves de
dépendances. Un instantané ou une preuve inexploitable **n'est jamais** assimilé
à une absence de blocage : le noyau échoue fermé avant tout paiement.

## Déterminisme et pureté

- Deux appels avec les mêmes entrées produisent des sorties identiques.
- Les entrées gelées en profondeur ne sont pas mutées (test dédié).
- Testé sur 100 tâches avec priorité, ancienneté et ordre variables, et sur un
  scénario d'épuisement du quota.
- Un test statique interdit au module toute importation `node:fs`,
  `child_process`, `http`, `net`, etc., ainsi que `Date`, `Math.random` et
  `fetch`.

## Validation exécutée localement

Sur la branche de la tâche :

- `node --test tests/asf-scheduler-core.test.mjs` → **30 tests réussis**.
- `npm run check` → **167 tests réussis**, puis `backlog:check`
  (11 actifs, 0 archivé), puis `node --check site/core.js` et
  `node --check site/app.js` ; aucun workflow GitHub n'est modifié, donc
  Actionlint n'est pas requis.

## Limites et éléments non revendiqués

- **Non revendiqué** : CI GitHub indépendante sur le bon SHA, fusion, essai
  après fusion sur `main`, intégration réelle avec l'adaptateur GitHub ou le
  journal durable. Aucun appel OpenRouter payant.
- Le noyau ne lit pas `backlog/index.json` lui-même : un adaptateur (ASF-V2-005)
  doit appeler ASF-V2-002 puis injecter la projection.
- La résolution transitive des dépendances se limite au fait que chaque
  dépendance directe est prouvée livrée ; la fermeture transitive est couverte
  par la validation du graphe (absence de cycle).
- Le noyau ne réserve ni ne consomme de quota : il ne fait que lire le journal
  injecté par l'appelant.
