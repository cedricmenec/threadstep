# ASF V3 : qualification du mutex GitHub Actions V1/V3 sans paiement modèle

**Statut : protocole de qualification à exécuter ultérieurement sur un dépôt GitHub d'essai isolé. Aucune exécution GitHub réelle n'est couverte par cette PR.**

**Fondation :** [PR #112, ASF-V3-025](https://github.com/cedricmenec/threadstep/pull/112) définit le contrat statique du mutex payé `threadstep-paid-development-v1`. Cette procédure prépare la preuve comportementale qui manque encore avant la mise en service.

## 1. Invariants de sécurité

1. Seuls les **jobs effectivement payants** V1 et le futur job V3 `paid-development` utilisent le groupe littéral `threadstep-paid-development-v1`, au **niveau du job**, avec `cancel-in-progress: false`. Ni parent, ni préflight, ni job d'ACK/CLAIM non payant ne retient ce groupe.
2. Une même clé de concurrence GitHub Actions n'agit **qu'à l'intérieur d'un dépôt**. Une copie de la clé dans un autre dépôt permet des essais sans interférer avec les jobs de `cedricmenec/threadstep`, mais ne prouve pas les permissions et le wiring réels de la production.
3. Avec la politique GitHub par défaut (`queue: single`), un nouveau job en attente peut remplacer/annuler l'ancien job `pending`. `cancel-in-progress: false` **ne garantit donc pas** une file FIFO sans pertes.
4. Le mutex est une **barrière d'ordonnancement**, pas un droit de dépense, ni une garantie d'exactly-once côté fournisseur. Un job `pending`, `cancelled`, `skipped`, perdu ou de statut ambigu ne déclenche **aucun retry payé automatique**.
5. Un job qui a obtenu le mutex ne peut encore démarrer un modèle que si les contrôles indépendants du mandat owner, du registre global, du `CLAIM_CHILD` durable, du quota, du run/attempt GitHub exact, des permissions et du budget sont tous valides. Aucun résultat de ce laboratoire n'autorise une dépense.

## 2. Préconditions du laboratoire

- **Autorisation propriétaire préalable** pour créer/configurer un dépôt d'essai séparé, y copier un workflow de simulation et déclencher ses runs. Cette PR ne crée pas ce dépôt.
- Ne **jamais** déployer le workflow de simulation dans `cedricmenec/threadstep` : avec la même clé, il interférerait avec V1.
- Aucun secret `OPENROUTER_API_KEY`, PEM d'App ou jeton d'écriture ; `permissions: contents: read` au maximum. Pas de modèle, de dispatch V1/V3, de branche opérationnelle, de ref global, d'environnement contrôleur ni de workflow réutilisable pointant vers la production.
- Les jobs simulés « V1 » et « V3 » sont des `workflow_dispatch` manuels. Leur charge est limitée à `echo`, `date` et une courte attente bornée, sans action réseau. Le coût éventuel des minutes GitHub Actions **n'est pas nul par définition** ; vérifier l'offre et les quotas avant les essais.
- Capturer et archiver pour chaque expérience le commit SHA du laboratoire, l'identité du workflow, le `run_id`, le `run_attempt`, le job ID, les horodatages `started_at/completed_at`, les états et conclusions GitHub REST ainsi que les URLs de jobs. Ne pas déduire un ordre total uniquement de l'ordre des `workflow_dispatch`.

## 3. Expériences à réaliser, sans paiement modèle

| ID | Déclenchements dans le dépôt d'essai | Résultat attendu / chose à vérifier |
| --- | --- | --- |
| M01 | Simu V1 longue, puis simu V3 avec **même** groupe job-level | Au plus un job du groupe `in_progress` ; le second est en attente tant que le premier occupe le mutex. |
| M02 | Simu V3 longue, puis simu V1 | Même exclusion mutuelle dans l'ordre inverse. |
| M03 | Un job en cours, puis deux jobs supplémentaires dans le même groupe, `queue: single` | Observer la possible annulation du premier `pending` par le plus récent ; ne pas imposer un FIFO sur l'ordre des dispatchs. |
| M04 | Deux jobs sur des **groupes différents** | Vérifier que la sérialisation de M01/M02 vient réellement de la clé commune, pas de la seule disponibilité d'un runner ; résultats non probants si le dépôt manque de capacité de parallélisme. |
| M05 | Job `pending` puis `cancelled` ou `skipped` | Documenter absence de reprise automatique, absence de toute action modèle et obligation de réconciliation owner avant décision ultérieure. |
| M06 | Job démarré, interruption/annulation volontaire d'essai, puis lecture REST | Statut ambigu ou interrompu = pas d'autorisation de retry ; preuves sauvegardées pour analyse. |
| M07 | Alterner les fichiers de simulations V1/V3, chaque fois même clé **job-level** | Vérifier que la portée du groupe est inter-workflows dans un même dépôt, sans laisser un préflight monopoliser le groupe. |

Une expérience est **inconclusive** si l'on ne peut pas établir de façon fiable les périodes d'exécution, si les jobs n'ont pas démarré dans la configuration prévue, ou si la capacité de runners masque la concurrence. Il est interdit de transformer une absence d'observation en preuve positive.

## 4. Collecte et décision

Pour chaque scénario, conserver un relevé comprenant : `scenario_id`, SHA, `run_id`, `run_attempt`, workflow/job, valeur du groupe configurée dans le YAML, états/conclusions et horodatages observés, URLs de preuves, verdict (`pass`/`fail`/`inconclusive`) et anomalie éventuelle. Un simple test unitaire du parseur YAML ou une réussite CI de #112 ne constituent pas cette preuve comportementale.

Le critère de **réussite du laboratoire** est la sérialisation observable des jobs du même groupe avec la mise en évidence de la politique `pending` du service. Ce succès ne signifie **pas** que V3 peut payer ni que son application GitHub, ses règles de protection et son journal CAS sont qualifiés.

**STOP / escalade propriétaire :** chevauchement réellement observé de jobs de même groupe, `cancel-in-progress` effectif inattendu, preuve REST contradictoire, exécution involontaire dans la production, ou doute sur les secrets et permissions. Ne pas ajouter une relance automatique pour « réparer » une annulation.

## 5. Question séparée : `queue: max`

La documentation GitHub actuelle expose `queue: max` (jusqu'à 100 jobs en attente) en alternative au `queue: single` implicite. Cette option change la stratégie de mise en file, peut affecter V1 et doit faire l'objet d'une **décision owner indépendante**, avec étude de compatibilité et de surcharge. Le vérificateur de la PR #112 refuse toute clé supplémentaire à son contrat initial. **Cette PR ne change ni le parser, ni les trois workflows V1, ni la politique des queues**.

Documentation de référence : [GitHub, Control the concurrency of workflows and jobs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

## 6. Suite avant le premier lancement payé V3

1. Implémenter **dans une PR de test distincte** le harness jetable destiné au dépôt isolé, puis faire auditer ses workflows.
2. Après permission explicite, lancer les scénarios sans fournisseur de modèle ; relever les preuves GitHub REST, conclusions et éventuels défauts.
3. Cadrer le branchement V3 réel : le `CLAIM_CHILD` durable doit précéder le job facturable, puis revérification du quota/mandat et du mutex juste avant consommation.
4. Réconcilier les chaînes de PR divergentes #111→#112→#113 et #116→#117 avant toute intégration, ainsi que les IDs de tâches ASF-V3-025 dupliqués.
5. Ne fusionner **aucun workflow privilégié**, n'activer **aucun secret** et n'effectuer **aucun appel OpenRouter** sans autorisation owner séparée.
