# ASF-SCH-001 : spécification Scheduler V1

**Statut :** approuvée pour découpage en tâches (non implémentée), version 0.1.  
**Nature :** moteur déterministe Node.js, sans modèle IA ni effet de bord dans le cœur métier.

## 1. Mission, entrées et sorties

Le Scheduler V1 identifie la prochaine tâche éligible au sein d'une vague autorisée. Il ne lance pas directement les workflows, ne fusionne pas les PR, ne décide pas du coût et ne modifie pas les tâches.

**Entrées :**

- `backlogSnapshot` : `backlog/index.json`, `backlog/archive-index.json`, fichiers de tâche et SHA de référence ; graphe des dépendances validé.
- `waveManifest` : autorisation figée, IDs candidats, hash des fichiers, politique de classement et plafonds.
- `deliveryEvidence` : état GitHub vérifié des tâches livrées, y compris celles provenant d'autres vagues.
- `executionState` : journal des tâches déjà réservées/déclenchées, runs/PR existants et statut du quota.

**Sortie fonctionnelle :**

```json
{
  "decision": "SELECT",
  "taskId": "TS-012",
  "reason": ["ready", "automation_allowed", "dependencies_delivered"],
  "observedAt": "2026-10-16T00:00:00Z"
}
```

Autres décisions : `NO_WORK`, `QUOTA_REACHED`, `WAITING_DEPENDENCIES`, `STOP_FAILED`, `STOP_UNCERTAIN`. Toute décision inclut une justification, les exclusions et les références des preuves. `observedAt` est fourni par l'adaptateur, pas calculé au hasard dans le cœur.

## 2. Ensemble de candidats figé et sélection dynamique

À la création de la vague, l'orchestrateur prend un **snapshot** des définitions présentes sur le commit autorisé. Il fige la liste des IDs retenus et les empreintes de contenu. Cette liste peut inclure une tâche `ready` dont la dépendance n'est **pas encore** livrée, afin qu'elle se débloque pendant la même vague.

Une nouvelle tâche ajoutée au dépôt, une modification de priorité ou un changement des critères d'acceptation pendant l'exécution n'élargissent ni ne modifient le périmètre autorisé. Avant tout déclenchement, la cohérence entre la définition figée et la définition exécutée est vérifiée. Si les octets de la tâche candidate divergent, arrêter ou exclure selon un verdict explicite, mais **jamais exécuter la version modifiée sans nouvelle autorisation**.

Après **chaque livraison vérifiée**, les mêmes définitions sont réévaluées avec les preuves de livraison actualisées. Aucune priorisation LLM n'intervient.

## 3. Éligibilité V1

Une tâche est sélectionnable si toutes les conditions suivantes sont prouvées :

1. Son ID appartient au manifeste figé et le hash de son fichier est celui autorisé.
2. `type = product`, `status = ready`, `automation = allowed`, `risk = low` (politique prudente proposée pour V1).
3. Elle n'a jamais été réservée ni déclenchée dans cette vague.
4. Elle n'est pas déjà livrée, dans une PR active, dans un workflow payant en cours, ni bloquée par une branche agent à reprendre.
5. Toutes ses dépendances directes et transitives ont un statut `delivered` **établi par les preuves GitHub**. L'archivage n'est pas requis pour satisfaire une dépendance.
6. La couche d'autorisation et d'exécution a confirmé une place disponible dans le quota, l'absence de vague concurrente et une acquisition exclusive possible.

Statuts `proposed`, `on_hold` et `canceled`, `automation: manual`, risque autre que `low`, tâches `factory` et métadonnées inconnues sont exclus. Les tâches historiques sans frontmatter V2 sont exclues tant qu'elles ne sont pas migrées.

Une erreur de lecture GitHub, une preuve de livraison non concluante, une dépendance inconnue ou une PR ambiguë ne sont **pas** interprétées comme une absence de blocage : verdict `STOP_UNCERTAIN` avant tout paiement.

## 4. Dépendances

- Le graphe est dirigé par `depends_on`; aucun cycle, ID inconnu ou dépendance sur la tâche elle-même n'est accepté.
- Une dépendance déjà livrée **hors de la vague** peut satisfaire une tâche si sa livraison est confirmée.
- Une dépendance incluse dans la vague et initialement non livrée peut devenir satisfaite après la livraison de son prédécesseur.
- Une dépendance non livrée et absente du périmètre figé reste bloquante pour cette vague.
- Si aucune tâche n'est éligible alors que des candidates subsistent, produire `WAITING_DEPENDENCIES` et arrêter proprement ; pas d'attente indéfinie ni d'ajout implicite au périmètre.
- Une dépendance livrée mais encore dans `backlog/tasks/` en attente d'archivage est **satisfaite** : l'emplacement du fichier ne détermine pas la livraison.

## 5. Algorithme et départage

Ordre stable des candidates éligibles :

1. Priorité : `critical > high > normal > low`.
2. Ancienneté de `created_at`, de la plus ancienne à la plus récente.
3. Identifiant canonique croissant comme dernier départage.

Le critère de priorité n'autorise jamais à outrepasser une dépendance, un risque ou une exclusion d'automatisation. Le numéro `TS-NNN` n'est pas une priorité métier.

Pseudocode :

```js
function selectNext({ manifest, tasks, deliveries, attempts, conflicts, quota }) {
  if (quota.taskStarts >= quota.maxTaskStarts) return { decision: 'QUOTA_REACHED' };
  if (attempts.some(a => a.failed)) return { decision: 'STOP_FAILED' };
  if (deliveries.unknown || conflicts.unknown) return { decision: 'STOP_UNCERTAIN' };

  const remaining = manifest.candidateTasks.map(item => item.id)
    .map(id => tasks.get(id))
    .filter(task => !attempts.some(a => a.taskId === task.id));

  const eligible = remaining
    .filter(task => definitionMatchesManifest(task, manifest))
    .filter(task => allowedByPolicy(task))
    .filter(task => !deliveries.has(task.id))
    .filter(task => !conflicts.has(task.id))
    .filter(task => task.depends_on.every(id => deliveries.has(id)))
    .sort(compareByPriorityThenAgeThenId);

  if (eligible.length) return { decision: 'SELECT', taskId: eligible[0].id };
  return { decision: remaining.length ? 'WAITING_DEPENDENCIES' : 'NO_WORK' };
}
```

`definitionMatchesManifest()` doit signaler une divergence en **erreur bloquante** avant filtrage : le pseudocode illustre le flux, pas une autorisation de masquer silencieusement une altération. De même, `NO_WORK` et `WAITING_DEPENDENCIES` seront affinés par des motifs explicites (`already_delivered`, `manual_only`, `blocked`, `in_progress`, etc.).

## 6. Contrat d'API interne (proposé)

Fonctions pures :

- `validateBacklog(snapshot) -> ValidationReport`
- `buildWaveCandidates(snapshot, policy) -> CandidateSet` (une fois à l'ouverture)
- `classifyEligibility(task, snapshot, evidence, policy) -> Verdict`
- `selectNextTask(manifest, snapshot, evidence, journal) -> SelectionDecision`
- `explainWave(manifest, evidence, journal) -> ReadableReport`

Les adaptateurs fournissent les preuves GitHub **avec statut `verified | unknown` et provenance**, pas de simples booléens inventés. Les fonctions n'utilisent pas d'horloge implicite, n'exécutent pas de réseau et ne mutent pas les entrées.

Le profil ThreadStep définit les chemins, les IDs `TS-NNN` et la politique `product`. Le noyau de sélection ne doit pas supposer que tout projet utilise ce préfixe.

## 7. Simulation et observabilité

Une commande indicative :

```text
node scripts/asf/scheduler.mjs dry-run --max-tasks 2 --format json
```

Le `dry-run` calcule une décision **sans lancer** OpenRouter, sans créer PR et sans réserver de quota. Il affiche les candidates, leurs motifs d'exclusion, l'ordre potentiel et les hypothèses nécessaires aux tâches futures. Si une tâche dépend d'une livraison future hypothétique, l'indiquer explicitement : une projection n'est pas une preuve de livraison.

En mode réel, chaque décision est ajoutée au journal de vague avec l'empreinte du manifeste, les références GitHub observées et la version de la politique.

## 8. Jeux de tests d'acceptation

| Cas | Résultat attendu |
| --- | --- |
| 100 tâches valides avec corps Markdown volumineux | Décision basée exclusivement sur index/métadonnées, sans LLM |
| Priorité forte sans dépendance | Passe avant priorité normale |
| Priorité critique dépendant d'une tâche normale | Critique bloquée, normale peut être sélectionnée |
| Livraison confirmée de la dépendance pendant la vague | Recalcul et déblocage de la tâche critique |
| Dépendance fusionnée mais non archivée | Considérée livrée si preuve suffisante |
| Dépendance non livrée hors vague | Pas d'élargissement automatique |
| Changement de tâche après autorisation | Refus ou arrêt avant exécution |
| Nouvelle tâche ajoutée à `main` | Ignorée durant la vague |
| PR ouverte / run actif / branche orpheline | Non-sélection, reprise manuelle si nécessaire |
| Check GitHub inaccessible / ambigu | `STOP_UNCERTAIN`, zéro nouvel appel payant |
| Quota déjà atteint ou échec constaté | Aucun autre déclenchement |
| Deux tâches de même priorité | Départage par date puis ID, reproductible |
| Dépendance cyclique ou manquante | Échec de validation du backlog |
| Risque moyen/élevé ou tâche factory | Exclusion en V1 |

## 9. Limitations délibérées

Pas de modification des priorités par IA, pas de planification multi-workers, pas de reprise automatique après une exécution payante incertaine, pas de résolution autonome de conflits Git, pas de remplacement automatique d'une tâche échouée. Ces capacités demanderaient un nouveau contrat et des preuves supplémentaires.