# Recette E2E progressive et mise en service contrôlée (ASF-V2-011)

**Statut :** recette **simulée** livrée dans la PR de la tâche, **non fusionnée**
et **non vérifiée par une CI GitHub indépendante**. Les phases payantes (pilote,
vague à deux tâches, CI rouge réel) restent **non exécutées** et exigent une
autorisation propriétaire distincte.
**Spécification normative :** [Orchestrator V1](specs/orchestrator-v1.md) (ASF-ORCH-001), §7, §8, §11, §12.
**Dépendances livrées :** [ASF-V2-008](tasks/ASF-V2-008.md), [ASF-V2-009](tasks/ASF-V2-009.md), [ASF-V2-010](tasks/ASF-V2-010.md).
**Tâche :** [ASF-V2-011](tasks/ASF-V2-011.md).

## Objet

Établir les preuves de sécurité et de fonctionnement **avant** de déclarer
l'orchestrateur opérationnel. La tâche distingue deux niveaux :

1. une **recette simulée**, non payante, qui démontre la logique de contrôle
   déterministe sur toutes les branches critiques ;
2. des **phases réelles** (pilote à une tâche, vague à deux tâches, cas CI
   rouge) qui ne peuvent être lancées qu'après une **nouvelle autorisation
   explicite** des exécutions OpenRouter et du périmètre.

Cette livraison couvre le niveau 1. Aucun appel OpenRouter, aucun dispatch,
aucune réservation, aucune écriture de journal, aucun changement de secret,
de permission ou de ruleset n'est effectué.

## Fichiers

- `scripts/asf/fixtures/e2e.mjs` : recette E2E déterministe en mémoire, 6 scénarios.
- `tests/asf-e2e-validation.test.mjs` : 10 tests (6 scénarios + garde de pureté).
- `docs/factory/e2e-validation.md` : le présent protocole.

La recette **réutilise** les modules purs déjà livrés (ASF-V2-004 à 010) : noyau
du scheduler, manifeste/journal/quotas, vérificateur de livraison. Elle ne
réimplémente ni la sélection ni les verdicts.

## Exécution

```text
node scripts/asf/fixtures/e2e.mjs
node --test tests/asf-e2e-validation.test.mjs
```

La recette est pure : ni réseau, ni horloge, ni `process.env`, ni écriture. Les
horodatages sont des constantes injectées et `paidCalls`/`dispatches` valent
toujours `0`.

## Scénarios et garanties démontrées

| Scénario | Garantie vérifiée | Résultat simulé |
| --- | --- | --- |
| `empty-backlog` | Backlog vide ⇒ `NO_WORK`, aucune candidate, aucune réservation, tâche hors vague refusée. | OK |
| `dependency-unblocks` | Une dépendance livrée (`verified`) débloque son dépendant **dans la même vague figée** ; recalcul dynamique de l'ordre. | OK |
| `crash-windows` | Avant dispatch : `DISPATCH` sûr. Pendant dispatch (`DISPATCH_RESERVED` sans run id) : `STOP_UNCERTAIN`. Après dispatch (`EXECUTING`) : `IN_FLIGHT`. Jamais de second dispatch automatique. | OK |
| `red-ci` | Un contrôle `check` en échec ⇒ verdict `pending` (jamais `verified`), aucune preuve transmise au scheduler, journal `STOP_FAILED`, aucun dispatch ultérieur. | OK |
| `two-task-wave` | Trois candidates, `max_tasks=2` : exactement deux réservations (`TS-011`, `TS-012`), `QUOTA_REACHED` pour la troisième, aucune troisième clé. Recalcul après chaque livraison vérifiée. | OK |
| `concurrent-access` | Un changement de journal avec SHA périmé est refusé (compare-and-swap). Le verrou global de développement payant (`threadstep-paid-development-v1`) bloque un lancement manuel concurrent tant que la vague le détient. | OK |

Résultats locaux : `node scripts/asf/fixtures/e2e.mjs` → 6/6 scénarios OK,
`paidCalls = 0`, `dispatches = 0` ; `node --test
tests/asf-e2e-validation.test.mjs` → **10 tests réussis**.

## Prérequis à vérifier au moment de la recette réelle

Ces contrôles GitHub ne sont **pas** exécutés par la recette simulée. Ils doivent
être relevés, horodatés et joints aux preuves au moment de la recette payante,
en **lecture seule** :

1. Ruleset `Protect Main` actif sur `main` : `protected: true`, PR et
   suppression/force-push interdits, aucun bypass.
2. Contrôle requis `check` fourni par GitHub Actions (integration_id 15368).
3. Permissions de la GitHub App réellement accordées : `Actions: read/write`
   pour le dispatch, `contents: write`/`pull-requests: write` pour les PR.
   Aucune extension `Workflows: write` non justifiée et approuvée.
4. Absence de contournement : ni `--admin`, ni push direct, ni désactivation des
   checks ; `auto_merge=true` ne peut que **demander** la fusion native après
   `check`.

Toute divergence (protection absente, check non requis, bypass possible)
**arrête** la recette et interdit toute phase payante.

## Protocole des phases payantes (non exécutées)

Chaque phase exige une autorisation propriétaire **distincte** avec périmètre et
budget bornés. Aucune de ces phases n'est autorisée par la fusion de cette
tâche.

### Pilote à une tâche (quota et contrôles)

1. Autoriser explicitement un unique lancement `mode=execute`, `max_tasks=1`.
2. Relever : `waveId`, run parent, tâche retenue, PR, `headSha`, `check` de PR,
   SHA de fusion, runs `CI`/`Pages` post-fusion, `reservation_sha`.
3. Prouver que le quota `taskStartsReserved` vaut 1 après réservation et ne
   permet aucun second départ.
4. Vérifier que le journal ne contient aucun secret et que la livraison est
   `verified` par le vérificateur indépendant.

### Vague à deux tâches (recalcul dynamique, aucun troisième)

1. Autoriser `max_tasks=2` sur deux tâches `product/ready/allowed/low` dont une
   éventuellement dépendante d'une tâche livrée pendant la vague.
2. Prouver le recalcul : après livraison **vérifiée** de la première, la
   deuxième est sélectionnée à partir du **même manifeste figé** et des preuves
   actualisées.
3. Prouver qu'**aucun troisième** départ n'est lancé : `QUOTA_REACHED`, aucune
   réservation supplémentaire, aucune PR concurrente.

### Cas CI rouge réel (absence de fusion forcée)

1. Produire volontairement un `check` en échec sur la PR d'une tâche autorisée
   (ou observer un échec réel).
2. Prouver qu'aucune fusion n'a lieu : le contrôle requis échoue, la PR reste
   ouverte, aucune commande `--admin` n'est utilisée, la demande d'auto-merge
   native ne fusionne pas.
3. Prouver que la vague s'arrête (`STOP_FAILED`) sans tenter de remplacement.

## Preuves à publier

À l'issue des phases réelles, publier sans secret : références de runs, numéros
et SHA de PR, verdicts `check`, états `CI`/`Pages`, `reservation_sha` et
contenu du journal, résultat d'archivage éventuel, et **limites réelles
observées**. Mettre à jour immédiatement
[`current-state.md`](current-state.md), la [roadmap](roadmap.md) et les
[décisions](decisions.md).

## Limites et éléments non revendiqués

- **Non revendiqué** : CI GitHub indépendante sur le bon SHA, fusion,
  vérification post-fusion sur `main`, exécution réelle du pilote ou de la vague,
  cas CI rouge réel, création de PR documentaire réelle, Pages.
- La recette simulée démontre la **logique pure** de contrôle, pas le
  comportement de GitHub Actions (file d'attente, remplacement de jobs
  `pending`, latence de checks). Ces comportements doivent être observés sur les
  runs réels.
- Les permissions GitHub App, l'état du ruleset et l'absence de bypass sont
  documentés comme **à vérifier au moment de la recette**, non mesurés ici.
- Aucun appel OpenRouter payant n'a été effectué pour cette tâche.
