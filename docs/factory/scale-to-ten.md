# Étude d'évolution — de 2 à 10 puis 15 tâches par vague ASF

**Note de reprise du 16 octobre 2026 :** l'utilisateur souhaite un nombre de tâches paramétrable, potentiellement jusqu'à **10 ou 15**. Le [backlog de préparation ASF V3](tasks/ASF-V3-README.md) conserve ce souhait et un découpage indicatif en PR. Cette page décrit principalement le premier palier technique **10** : les garanties devront être **étendues et prouvées jusqu'à 15**, notamment `maxTaskStarts <= 15`, rejet d'un 16e départ, sécurité/authentification, journal, timeouts, reprise et tests. Le maximum effectif, le budget et les étapes de mise en service sont **à décider plus tard**. L'orchestrateur V1 en production reste limité à 1 ou 2 tâches.

**Statut : proposition d'architecture, pas une fonctionnalité disponible.** La V1 réelle supporte exclusivement `max_tasks=1|2`. Une vague à deux tâches a été validée sur [run 38910657187](https://github.com/cedricmenec/threadstep/actions/runs/38910657187). Aucun plafond USD fournisseur n'est garanti.

## Pourquoi « choisir 10 » ne fonctionne pas aujourd'hui

| Verrou actuel | Code à faire évoluer |
| --- | --- |
| Formulaire propose seulement « 1 » ou « 2 » | `.github/workflows/backlog-orchestrator.yml` |
| Validation de l'entrée refuse « 10 » | `scripts/asf/waves/orchestrate.mjs`, `readInputs()` |
| Manifeste refuse `maxTaskStarts > 2` | `scripts/asf/waves/manifest.mjs`, `MAX_TASK_STARTS` |
| Authentificateur refuse `maxTaskStarts > 2` | `scripts/asf/waves/authenticate-executor.mjs` |
| Graph de jobs codé en dur | `first` → `after_first` → `second` → `after_second` |
| `settle` ferme explicitement au second slot | `scripts/asf/waves/orchestrate.mjs`, condition `ASF_SLOT === "2"` |
| Tests, menaces et documentation ciblent V1/2 | `tests/asf-*.test.mjs`, contrats et modèles de sécurité |

**Modifier uniquement le menu YAML n'est pas suffisant**, et désactiver l'authentificateur pour y parvenir serait une faille.

## Proposition : Orchestrator V2 séquentiel, borné à 10

1. Conserver l'autorisation propriétaire `workflow_dispatch` et un manifeste **immuable**, qui fige au maximum dix **démarrages**, les IDs candidats et SHA des fiches, le modèle, une identité de vague et le commit source. Pour chaque run, sélectionner `1..10` en quota explicite.
2. Extraire la logique `prepare / reserve / dispatch / verify / settle` vers un **contrôleur de vague unique** (state machine durable) qui itère jusqu'au quota ou à `NO_WORK` / `STOP_FAILED` / `STOP_UNCERTAIN`, **une tâche à la fois** (`maxConcurrentTasks=1`). Éviter une stratégie matrix parallèle, qui ne peut pas simplement garantir le recalcul dynamique depuis le résultat du slot précédent.
3. Réutiliser l'exécuteur OpenSpec avec une **autorisation corrélée au manifeste et à la réservation**. Le contrôleur peut, dans une refonte explicitement auditée, dispatcher des workflows enfants via l'API GitHub puis attendre leur résultat et surtout vérifier indépendamment leur PR, check, merge, CI et Pages. La preuve de parenté `GITHUB_RUN_ID` doit être adaptée et testée : ne pas copier aveuglément l'actuel `workflow_call`.
4. Journaliser avant chaque appel payant une réservation monotone, identifiant `waveId/taskId`, SHA et révision comparée. Vérifier `head SHA` et preuves `CI`/`Pages` après chaque fusion avant de réserver la suivante. Ne jamais déduire `DELIVERED` du seul succès de job.
5. Échec/annulation/timeout/conflit/crash/API inconnue => **arrêt de toute la vague**, quota consommé, **zéro retry payant automatique**. Reprise seulement sur décision humaine et vérification des journaux et PR. Revalider le backlog figé et refuser toute définition modifiée.
6. Ajouter un **budget explicite avant le lancement** (USD/limite fournisseur) ou une politique externe restrictive. Un quota 10 ne contrôle pas le coût : en `phase=auto`, chaque tâche peut engendrer plusieurs appels OpenCode/OpenRouter. Prévoir dépenses par vague et alertes par modèle ; si l'API fournisseur ne fournit pas de réserve atomique, dire clairement que le plafond reste indicatif.
7. Définir la gestion du temps : une vague de dix tâches peut durer bien au-delà d'un run GitHub Actions (durée max, latences CI/Pages, files d'attente). Préférer un orchestrateur à **checkpoints entre runs** avec réconciliation bornée et reprise autorisée plutôt qu'un job unique à durée illimitée.
8. Ne toucher aux règles de GitHub, secrets ou permissions **qu'avec une PR factory de sécurité distinctement approuvée** ; maintenir les tests indépendants sur `main` et le refus des bypass.

## Plan de livraison proposé

| Étape | Objet et acceptation |
| --- | --- |
| ASF-V3-001 | ADR/menaces, schéma de manifeste de vague 1..10, politique budgets/concurrence ; pas de run payant |
| ASF-V3-002 | Contrôleur en boucle à état durable, idempotence et comptage des réservations ; simulations 0/1/2/3/10/11 |
| ASF-V3-003 | Exécuteur enfant authentifié par réservation et run parent réconciliés, séparation read/write et verrou payant |
| ASF-V3-004 | GitHub Actions/dispatcher, timeout/backoff, preuve PR+CI+Pages entre chaque tâche |
| ASF-V3-005 | Tests d'interruption, rouge CI, ambiguïtés, race, redémarrage, budget ; revues sécurité |
| ASF-V3-006 | Déploiement progressif : dry-run à 3 puis 10 ; pilote payé 3, 5, puis 10, **avec autorisation distincte à chaque palier** |

Les identifiants ASF-V3 ci-dessus sont **indicatifs** : il ne s'agit ni de fiches de backlog créées ni d'actions exécutables. Il est possible de produire un prototype plus simple avec dix blocs de jobs fixes, mais il duplique les contrôles et augmente les risques d'oubli ; la boucle durable est plus appropriée.

## Réussite attendue

- `max_tasks=10` => **au plus dix réservations et dix démarrages**, jamais onze ; nombre de tâches réellement livrées éventuellement inférieur en cas d'arrêt.
- Toutes les tâches proviennent du même ensemble candidat autorisé, sans changement de hash entre gel et démarrage.
- **Une seule tâche payante à la fois**, avec CI de fusion et Pages complètes avant le prochain départ.
- Incertitude ou échec => stop conservateur, journal et diagnostic exploitables, aucune reprise implicite.
- Rapport consolidé des dix slots, PR, SHA, checks, coûts observés, et anomalies sans secret.

**Décision actuelle : maintenir la V1 à deux** tant que cette nouvelle politique n'a pas été définie, revue, implémentée et éprouvée.
