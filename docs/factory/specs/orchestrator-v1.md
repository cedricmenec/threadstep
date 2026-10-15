# ASF-ORCH-001 : spécification Orchestrator V1

**Statut :** approuvée pour découpage en tâches (non implémentée), version 0.1.  
**Périmètre :** orchestration manuellement déclenchée de tâches produit `ready`, au moyen de GitHub Actions et de l'exécuteur OpenSpec existant.

## 1. Objectif et principes non négociables

Un lancement autorisé doit : figer un ensemble de tâches candidates, en sélectionner une à la fois, lancer au maximum le nombre de tâches payantes prévu, vérifier chaque livraison réelle, recalculer la prochaine sélection, puis produire un rapport et une PR documentaire d'archivage pour les livraisons vérifiées.

**Invariants :**

- Aucune vague payante sans clic explicite du propriétaire et paramètres bornés.
- Aucune tâche hors snapshot initial ; aucun ajout opportuniste, même si `main` évolue.
- Maximum **2 tâches déclenchées** par défaut (V1 proposée configurable entre 1 et 2). Une réservation avant appel consomme le quota ; un échec ne le restitue pas automatiquement.
- **0 retry payant automatique**, 1 implémenteur en vol, arrêt au premier échec ou état ambigu.
- Le résultat `success` d'OpenSpec ne prouve pas la livraison : confirmation indépendante des PR, SHA, checks et fusion.
- `main` uniquement par PR respectant `Protect Main` et `check` ; jamais `--admin`, aucun push direct, aucun contournement des secrets ou de la CI.
- Une tâche livrée reste livrée si l'archivage documentaire échoue.

## 2. Architecture et séparation des rôles

```text
workflow_dispatch (propriétaire)
   |
   v
backlog-orchestrator.yml
   |-- preflight : autorisation + schéma + snapshot
   |-- scheduler : choix déterministe
   |-- journal : réservation persistante et corrélation
   |-- dispatcher : lancement authentifié de l'exécuteur
   |-- verifier : run, PR, SHA, CI, merge et contrôles post-merge
   |-- boucle : recalcul / quota / stop
   `-- archiver : PR documentaire + rapport
                    |
                    v
          agent-openspec.yml (exécuteur)
                    |
                    v
              PR finale + CI + GitHub native auto-merge
```

Le noyau de planification est indépendant du fournisseur de modèle, d'OpenSpec et de ThreadStep. L'exécuteur conserve la logique plan/apply/sync/archive. Le workflow manuel actuel doit demeurer fonctionnel indépendamment de l'orchestrateur.

## 3. Déclenchement et autorisation

Entrées proposées pour `backlog-orchestrator.yml` :

| Input | Valeur proposée | Contrat |
| --- | --- | --- |
| `mode` | `execute` par défaut ; `dry-run` disponible | `dry-run` n'appelle jamais OpenRouter |
| `max_tasks` | `2`, borne V1 : `1..2` | Maximum de **réservations de déclenchements payants**, pas de livraisons |
| `model` | Modèle OpenRouter explicitement choisi | Allowlist cohérente avec le moteur existant |
| `auto_merge` | `true` pour la voie autonome | Demande native différée uniquement après garde de protection |
| `execution_protocol` | `openspec` | Mode direct hors V1, adaptable ensuite |

La liste des tâches n'est pas saisie manuellement. Le snapshot initial comprend les tâches `ready`/`allowed`/`product`/`low` admissibles, y compris celles bloquées temporairement par des dépendances. Les tâches non qualifiées sont exclues avec motif. L'exécution directe `execute` doit calculer et vérifier ce périmètre avant le premier appel payant : la prévisualisation **n'est pas obligatoire**.

Une vague autorisée ne donne pas permission générale d'altérer les workflows, `AGENTS.md`, les règles GitHub ou les secrets. Les paramètres exacts et la provenance du clic propriétaire doivent être consignés, sans donnée secrète.

## 4. Manifeste figé

Exemple **fictif** :

```json
{
  "schemaVersion": 1,
  "waveId": "wave-example-001",
  "repository": "cedricmenec/threadstep",
  "authorizedBy": "repository_owner",
  "backlogCommit": "<commit-sha>",
  "policyVersion": "asf-orch-v1",
  "mode": "execute",
  "executor": "openspec",
  "phase": "auto",
  "model": "<model-allowlisted>",
  "limits": {
    "maxTaskStarts": 2,
    "maxConcurrentTasks": 1,
    "maxPaidRetries": 0
  },
  "autoMerge": true,
  "candidateTasks": [
    { "id": "TS-012", "sha256": "<file-sha256>" },
    { "id": "TS-013", "sha256": "<file-sha256>" }
  ]
}
```

Le manifeste est **immuable** une fois autorisé. La preuve d'autorisation est associée à l'ID du run parent et au SHA du snapshot. L'identité GitHub réelle, pas le simple champ `authorizedBy`, est la source d'authentification. Avant le dispatch, le contenu exact de la tâche utilisée doit correspondre à l'empreinte approuvée.

`main` peut avancer après chaque PR fusionnée : seul le **périmètre et les définitions autorisées** restent figés. L'exécuteur peut partir de la version courante de `main` pour intégrer les livraisons antérieures, tout en relisant le brief de tâche figé et en vérifiant qu'il est toujours applicable. Un conflit entre snapshot et nouveau code conduit à l'arrêt, pas à un élargissement implicite.

## 5. Journal durable et quota

Un journal de vague persistant distinct du manifeste consigne : `waveId`, `runId` parent, état de vague, `taskStartsReserved`, identifiants de tâches, clé `waveId/taskId`, ID et URL du run enfant, PR et `headSha`, verdicts CI, commit de fusion, actions d'archivage et motifs d'arrêt.

**Stratégie candidate à éprouver :** branche opérationnelle dédiée `asf/waves/<wave-id>` contenant le manifeste et des commits de journal. Elle n'est pas `main`, ne contient aucun secret et n'est pas alimentée par le modèle. Les mises à jour doivent être sérialisées avec vérification du SHA attendu ; une écriture concurrente ou une branche divergente provoque un arrêt.

Procédure obligatoire avant chaque appel payant :

1. Valider à nouveau le manifeste, l'exclusivité et le quota.
2. Écrire durablement une réservation `DISPATCH_RESERVED` avec clé unique `waveId/taskId` ; incrémenter `taskStartsReserved` **avant** l'appel.
3. Déclencher une seule fois `agent-openspec.yml` avec les métadonnées de corrélation et une preuve d'autorisation vérifiable.
4. Persister immédiatement le `workflow_run_id` reçu ou son verdict. Si la réponse réseau est ambiguë ou la persistance échoue, passer en `DISPATCH_UNCERTAIN` et **ne jamais rejouer automatiquement**.
5. Reconstituer l'état réel auprès de GitHub avant toute action de reprise manuelle.

Une réservation peut consommer le quota même si la facturation n'est pas démontrée : la priorité est d'interdire un éventuel second déclenchement. La V1 vise une sécurité **au plus une tentative automatique par clé**, pas une promesse d'exactly-once transactionnel entre Git et l'API GitHub. Tester explicitement les fenêtres de crash.

## 6. Intégration avec GitHub Actions / OpenSpec

### 6.1 Adaptations nécessaires à `agent-openspec.yml`

Le workflow actuellement en `workflow_dispatch` refuse toute exécution si `github.actor != github.repository_owner` et sérialise uniquement par `TS-NNN`. Il faut ajouter une voie orchestrée avec **contrôle de provenance**, sans accepter un booléen `orchestrated: true` comme autorisation en soi.

Proposition : le run enfant reçoit `wave_id`, `task_id`, `manifest_ref` et `parent_run_id`, retrouve le manifeste autorisé via un accès GitHub authentifié, vérifie l'identité et le statut du parent, son périmètre et sa réservation active, ainsi que son propre chemin/branche. Les prévalidations doivent précéder tout appel OpenRouter. Toute vérification manquante échoue de manière fermée. Le mode manuel reste autorisé au propriétaire comme aujourd'hui.

L'orchestrateur doit utiliser une GitHub App avec `Actions: write` pour dispatcher et `Actions: read` pour suivre les runs ; il devra conserver les droits de PR/contents nécessaires selon leur usage. Toute extension de permissions de la GitHub App fait l'objet d'une autorisation/admin distincte. Éviter `Workflows: write` sauf justification formellement approuvée.

L'API REST officielle de dispatch peut renvoyer l'ID du run et les URL. L'intégration fixe la version d'API retenue et traite explicitement ses codes de retour ; si aucune corrélation sûre n'est disponible, arrêt sans deuxième dispatch. Documentation : https://docs.github.com/en/rest/actions/workflows .

### 6.2 Exclusion mutuelle et verrous

- Une seule vague active par dépôt (contrôle d'acquisition dédié).
- Un seul développement payant en cours par dépôt pour la V1, que son origine soit manuelle ou orchestrée.
- Le contrôleur parent **ne doit pas tenir le même verrou de job que son exécuteur enfant** pendant qu'il attend celui-ci : cela provoquerait un interblocage.
- Un verrou par tâche reste utile contre les doublons ; il ne suffit pas pour le séquencement global.
- Le fonctionnement des `pending` jobs, leur remplacement et la disponibilité de l'option `queue: max` doivent être testés sur le GitHub réellement utilisé. Un verrou Actions seul n'est pas une transaction de réservation de quota. Documentation : https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency .

### 6.3 Séparation des privilèges

Le scheduler ne possède aucun token d'écriture ; le dispatcher obtient uniquement les permissions d'Actions nécessaires ; l'exécuteur conserve son jeton App temporaire pour branche et PR ; l'archiveur utilise un chemin privilégié **déterministe** ne reprenant pas de code non fiable ni de secrets dans une PR. Ne pas utiliser `pull_request_target` pour exécuter du code provenant d'une PR non fiable.

## 7. Cycle d'une tâche et preuves de livraison

États observables minimaux :

```text
SELECTED -> DISPATCH_RESERVED -> EXECUTING -> PR_PUBLISHED
         -> CI_PENDING -> MERGE_PENDING -> MERGED
         -> POST_MERGE_VERIFIED -> DELIVERED

Depuis toute étape : FAILED / BLOCKED / UNKNOWN -> STOP WAVE
```

Un run OpenSpec `success` constitue seulement une **preuve d'exécution du workflow**. Il ne prouve pas la fusion ni le déploiement.

Avant `DELIVERED`, le vérificateur doit au minimum confirmer :

1. L'ID de run enfant et la tâche rattachés à la réservation autorisée.
2. La PR finale pertinente (pas une PR OpenSpec `plan`), base `main`, branche attendue, absence de conflit et `headSha` exact ; la PR n'est pas un brouillon.
3. Le contrôle indépendant obligatoire `check` réussi sur le SHA attendu, avec provenance GitHub attendue, et les règles de protection applicables (pas de contournement).
4. La fusion effective de **cette PR** sur `main` ; le SHA de fusion est enregistré.
5. Les contrôles post-fusion exigés par le profil produit (par exemple CI de `main` et Pages pour ThreadStep) sont vérifiés ; une absence de preuve entraîne attente bornée puis arrêt, pas une déclaration optimiste.
6. Une absence de doublon ou de PR concurrente sur la tâche.

`auto_merge: true` permet seulement de **demander la fusion native différée** si les garde-fous sont vérifiés. `auto_merge: false` implique une attente bornée d'une fusion humaine ou l'arrêt `MERGE_PENDING`, jamais une fusion forcée.

Après `DELIVERED`, actualiser les preuves et **recalculer** la prochaine tâche parmi les mêmes candidats figés. Si le quota est épuisé, ne pas dispatcher de tâche supplémentaire.

## 8. Arrêts et sorties

| Situation | Action de V1 |
| --- | --- |
| Aucun candidat éligible | Terminer `NO_WORK`, sans appel OpenRouter |
| Dépendances toutes bloquées | Terminer `BLOCKED`, détailler les prérequis |
| Quota de réservations atteint | Arrêter les déclenchements ; terminer les vérifications en cours |
| Échec OpenSpec / CI rouge / conflit | Arrêter immédiatement les nouvelles exécutions ; préserver branches et PR pour diagnostic |
| PR non fusionnée à l'expiration | Arrêt `MERGE_PENDING`, sans lancer la suite |
| État API inconnu / dispatch incertain | Arrêt `STOP_UNCERTAIN`, aucune relance payante automatique |
| Annulation volontaire | Demander l'arrêt ; vérifier aussi le run enfant avant de considérer la vague stoppée |
| Interruption du contrôleur | Journal et ressources existantes inspectés avant toute reprise ; pas de deuxième dispatch automatique |
| Tâche livrée, archivage échoué | Conserver `DELIVERED`, ouvrir/maintenir une dette `ARCHIVE_PENDING` |

Les délais de polling et d'expiration doivent être configurables, adaptés aux limites de jobs GitHub, et validés sur runs de test. Le contrôleur doit toujours produire un rapport final lorsque possible, même en état partiel.

## 9. Archivage en fin de vague

Après la fin des tentatives (succès complet ou échec partiel), l'archiveur récupère **uniquement** les livraisons vérifiées. Une PR documentaire unique regroupe leurs déplacements vers `backlog/archive/`, les références de livraison, la régénération d'index et les liens affectés. Un run contrôlé par la GitHub App peut ouvrir cette PR, mais **ne contourne ni la CI ni `Protect Main`**. Une automatisation de fusion ne vaut que dans le périmètre de l'autorisation de vague ; sinon revue/fusion humaine.

Le script actuel `scripts/request-safe-auto-merge.mjs` valide des branches agent `agent/TS-NNN` ou `agent/openspec/TS-NNN`. Une PR d'archive sur une branche documentaire nécessitera donc une **adaptation séparée et testée** du garde-fou, et non une invocation telle quelle.

Si la vague s'arrête sur une deuxième tâche échouée, la première, déjà livrée, reste archivable. Si aucune tâche n'est livrée, aucune PR d'archivage n'est produite. Les livraisons manuelles seront reprises par une réconciliation distincte.

## 10. Rapport final attendu

Le rapport doit contenir : mode, modèle, date de début/fin, manifeste et commit de référence, quota réservé/utilisé, ID des tâches retenues, raisons du classement, run enfant et lien, PR et SHA, checks, résultat de fusion, éventuels contrôles Pages, archivée/à archiver, motifs des blocages, état du journal et prochaines actions. N'y inclure ni secret, ni tokens, ni donnée sensible fournisseur.

Un résumé humain et une version JSON sont souhaitables. Les statuts doivent différencier `delivery_verified`, `archive_pending`, `failed`, `unknown` et `not_started`.

## 11. Critères d'acceptation E2E

- [ ] `dry-run` fonctionne sans OpenRouter et expose ordre, dépendances et exclusions.
- [ ] `execute` commence sans `dry-run` préalable et fige effectivement ses candidats.
- [ ] Une vague initialement vide termine avec **zéro** déclenchement payant.
- [ ] Trois candidates, `max_tasks=2` : au plus deux réservations et dispatchs, même en cas d'erreur.
- [ ] Une dépendance non livrée est bloquée ; sa livraison vérifiée peut la débloquer pendant la même vague.
- [ ] Une tâche créée/modifiée après snapshot ne peut pas entrer dans la vague ni être exécutée sous une définition différente.
- [ ] Un succès OpenSpec sans PR fusionnée ne débloque pas la suivante.
- [ ] Une CI rouge ou un contrôle inaccessible arrête la vague, et aucune fusion non autorisée n'a lieu.
- [ ] L'auto-merge natif ne contourne ni `Protect Main` ni le check `check`.
- [ ] Un lancement manuel concurrent ou une deuxième vague ne peuvent pas déclencher un développement simultané en V1.
- [ ] Crash avant/pendant/après dispatch : les preuves du journal permettent un diagnostic ; aucun second appel payant n'est lancé sans autorisation explicite.
- [ ] Un run annulé ne laisse pas, sans détection, un enfant encore actif.
- [ ] L'archivage partiel ouvre une seule PR pour les livraisons vérifiées, conserve les échecs hors archive et respecte la CI.
- [ ] Le mode manuel OpenSpec d'origine reste opérationnel après les adaptations.
- [ ] Le rapport final est vérifiable par des liens GitHub et des SHA, sans secrets.

## 12. Déploiement progressif et autorisations

**Phase 0 :** spécifications, documentation ASF et décision/ADR.  
**Phase 1 :** schéma Backlog V2, index et `dry-run` scheduler non payant.  
**Phase 2 :** machine à états, journal, dispatch **simulé**, tests de panne et d'idempotence.  
**Phase 3 :** intégration authentifiée OpenSpec, vérificateur GitHub et archivage sur une vague **d'une** tâche explicitement autorisée.  
**Phase 4 :** validation de deux tâches séquentielles, dont un test de dépendance, une CI rouge contrôlée, et preuve de non-duplication.

Tout changement de workflow, de permissions GitHub App ou de sécurité exige une PR dédiée avec sa tâche documentaire sous `docs/factory/tasks/` et les validations du contrat `AGENTS.md`. Toute exécution OpenRouter réelle nécessite une **autorisation de lancement distincte**. Pas de fusion de PR sans autorisation applicable et contrôles réussis.

## 13. Points à valider avant implémentation payante

- Contrat exact d'authentification inter-workflows et permissions GitHub App réellement disponibles.
- Preuve d'idempotence et de restauration du journal opérationnel, en particulier à la frontière `dispatch`.
- Vérificateur post-fusion : quels checks constituent `DELIVERED` pour chaque profil produit et quels délais bornés utiliser.
- Stratégie de verrou couvrant aussi les lancements manuels sans interbloquer le parent.
- Cas documentaires non produit et adaptation sûre du script d'auto-merge aux branches d'archive.
- Comportement à adopter si un run terminé n'expose pas de façon fiable l'ID de PR ou le SHA.