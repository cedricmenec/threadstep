# Agent ASF V2 : documentation fonctionnelle et technique de chaque step

**Workflow source :** [`.github/workflows/agent-asf.yml`](../../../.github/workflows/agent-asf.yml), inspecté à partir de `main` au SHA `646da5ba6b494948aa7d7f7647ef485066900cd2`. **État documenté : V2, pas exécuteur V3 généralisé.**

## Fonction et différences avec l'agent manuel produit

L'Agent ASF implémente des évolutions **de la factory elle-même** pour une tâche factory explicitement autorisée par la politique versionnée. Il ne sert pas à développer les tâches produit `TS-NNN`. La machine qui exécute OpenCode ne possède **pas** de jeton GitHub App d'écriture ; le contexte privilégié de publication récupère un *patch* qu'il considère non fiable, le valide contre une politique approuvée, puis obtient ses credentials juste avant de pousser la branche et de créer une PR. Aucune auto-merge.

L'agent produit `agent.yml` utilise un seul job `develop`, avec obtention préalable d'un jeton GitHub App dans ce job. L'Agent ASF dispose de **trois jobs séparés** : `preflight -> develop -> publish`, et interdit aux agents les workflows et leurs propres garde-fous.

## Déclencheur, paramètres et protections globales

- `on.workflow_dispatch` seulement : propriétaire du dépôt, référence `refs/heads/main`, formulaire avec `task_id` et `model`. Le champ décrit `ASF-V2-001` à `ASF-V2-011` mais la politique et les vérifications, non la simple chaîne de formulaire, déterminent l'éligibilité.
- `permissions.contents: read` en tête, `concurrency.group: asf-task-<task_id>`, `cancel-in-progress: false` : pas de deuxième run du même identifiant à la fois.
- Modèles proposés : `openrouter/deepseek/deepseek-v4.1-flash` (défaut), `openrouter/z-ai/glm-5.3-flash`. Chaque clic valide autorise seulement **ce** développement payant ; aucune limite USD n'est garantie.
- Sources de vérité : [politique d'exécution](../../../scripts/agent-asf-policy.mjs), [vérificateur GitHub des dépendances](../../../scripts/verify-asf-dependencies.mjs), [contrat ASF](../../../AGENTS.md) et [mode opératoire historique](../agent-asf-manual.md).
- La politique connaît exclusivement des IDs `ASF-V2-001..011`, refuse avant modèle les tâches `ASF-V2-008/009` qui touchent des workflows et interdit toujours `.github/workflows/` et `scripts/agent-asf-policy.mjs` dans tout patch. Les livraisons historiques sensibles avaient une voie de revue humaine distincte.

## Job 1. `preflight` : aucune dépense avant preuve d'éligibilité

**`if` :** propriétaire et `main`. **Runner :** Ubuntu, **timeout :** 5 minutes. **Permissions :** `contents: read`, `pull-requests: read`, `checks: read`, `actions: read`. **Output :** `task_id` validé. En cas de rejet, `develop` ne part pas.

| Step exact, ordre YAML | Ce qu'il fait techniquement | Raison fonctionnelle et échec |
| --- | --- | --- |
| 1. `actions/checkout@v4` | Extrait le dépôt avec `persist-credentials: false`. | Lire la version des règles et de la tâche sans conserver de credential Git dans la copie de travail. Un checkout échoué bloque toute suite. |
| 2. `actions/setup-node@v4` | Prépare Node 22 sur le runner. | Exécuter le validateur JavaScript avec un runtime connu ; installation échouée = pas de preflight. |
| 3. `Validate ASF task before spending` | Exécute `agent-asf-policy.mjs preflight`, puis `verify-asf-dependencies.mjs` avec `GH_TOKEN` en lecture ; vérifie l'absence de PR ouverte correspondant au titre de tâche ; écrit `task_id` dans `GITHUB_OUTPUT`. | Refuser tâche inconnue, non prête, dépendance non livrée/ambiguë, tâche déjà en PR, avant tout appel OpenRouter. L'API GitHub est source de preuve, non les seules mentions Markdown. |

**Pourquoi ce job est essentiel :** il évite une dépense et une modification potentiellement dangereuse lorsqu'une autorisation de tâche ou une dépendance est insuffisante. La vérification de PR concurrente est un garde-fou additionnel, pas une preuve transactionnelle universelle.

## Job 2. `develop` : implémentation non privilégiée

**`needs: preflight`**, propriétaire seulement. **`concurrency: threadstep-paid-development-v1`** partagé avec les agents produit. **Timeout :** 45 minutes. **Permissions :** `contents: read`. **Entrées :** `task_id` issu du preflight, `model`. La clé `OPENROUTER_API_KEY` n'est injectée que dans le step payant, pas dans les steps de publication.

| Step exact, ordre YAML | Ce qu'il fait techniquement | Raison fonctionnelle et échec |
| --- | --- | --- |
| 1. `Checkout trusted main without write credentials` | `actions/checkout@v4`, `fetch-depth: 0`, `persist-credentials: false`. | Fonder le patch sur la base de confiance sans accès d'écriture persistant. |
| 2. `actions/setup-node@v4` | Node 22. | Fournir les commandes de validation Node au job. |
| 3. `Freeze trusted policy away from agent workspace` | Copie `scripts/agent-asf-policy.mjs` vers `$RUNNER_TEMP/agent-asf-policy.mjs` avant la génération. | L'agent ne peut pas rendre son propre patch admissible en changeant le fichier de règles lu pour la validation. |
| 4. `Install OpenCode (no repository write credentials)` | Installe `opencode-ai@latest` et imprime sa version, sans token App. | Mettre en place l'outil de développement sans lui donner les droits de publication. `@latest` signifie version non figée, risque à maîtriser ultérieurement. |
| 5. `Implement selected factory task with OpenRouter` | Injecte `OPENROUTER_API_KEY` dans **ce step** ; construit dans le répertoire temporaire un prompt incluant la tâche sélectionnée et les contraintes de sécurité, puis lance `opencode run --auto --model`. | Effectuer la tâche sous contrainte de chemins et critères ; l'agent ne doit ni toucher aux secrets ni pousser de code. Peut engager des coûts OpenRouter ; une panne arrête le job. |
| 6. `Verify and export diff without secrets` | Exécute `npm run check`, `git add -A` puis la copie gelée de la politique en mode `validate` ; construit un patch binaire Git, refuse un patch vide ou >1,5 Mo et le place comme `asf-agent.patch`. | La sortie à confier au publisher est un artefact borné et contrôlé, pas un accès direct Git. Tests en échec ou changement hors allowlist => aucune publication. Le nom du step n'est pas à lui seul une garantie de détection de **tous** secrets. |
| 7. `actions/upload-artifact@v4` | Transfère `asf-agent.patch` comme artefact `asf-diff` avec rétention de trois jours. | Permettre au publisher d'inspecter/rejouer le patch dans une autre zone d'exécution ; absence d'artefact = échec. |

**Pourquoi ce job est essentiel :** la génération de code par modèle est une zone non fiable. Elle doit produire un contenu vérifiable, sans aucun jeton d'écriture à sa disposition. Le verrou partagé évite l'exécution de plusieurs jobs payants concurrents.

## Job 3. `publish` : frontière de confiance et PR humaine

**`needs: [preflight, develop]`**, propriétaire seulement. **Timeout :** 15 minutes. **Permissions initiales :** `contents: read`. **Entrée :** patch `asf-diff` et ID validé. **Sortie :** branche `agent/asf/<task_id>-run-<run_id>` et PR, sans auto-merge.

| Step exact, ordre YAML | Ce qu'il fait techniquement | Raison fonctionnelle et échec |
| --- | --- | --- |
| 1. `Checkout trusted source, no write credentials` | `actions/checkout@v4` sur `github.sha`, historique complet et `persist-credentials: false`. | Repartir du SHA de confiance qui a déclenché l'exécution, pas d'un workspace modifié par OpenCode. |
| 2. `actions/setup-node@v4` | Node 22. | Permettre la réexécution du précontrôle et du validateur. |
| 3. `actions/download-artifact@v4` | Récupère `asf-diff` dans `$RUNNER_TEMP/asf-artifact`. | Transporter la proposition de code vers le contexte de publication sans lui attribuer de confiance implicite. |
| 4. `Apply and validate untrusted patch BEFORE minting publisher token` | Copie d'abord la politique approuvée hors workspace, valide de nouveau la tâche et la taille du patch, crée une branche locale, fait `git apply --index --check` puis `git apply --index`, exécute la politique sur le diff préparé et committe le résultat. | Frontière de sécurité centrale : refuser les chemins interdits et le contenu invalide **avant** d'obtenir un token d'écriture. Échec => aucun token de publication créé par le step suivant. N'exécute pas de scripts issus du patch dans ce job privilégié. |
| 5. `Mint publisher token for ordinary reviewed factory changes` | `actions/create-github-app-token@v1` avec `APP_ID` et `APP_PRIVATE_KEY`, permissions App `contents: write` et `pull-requests: write` seulement. | Créer un credential limité **après** approbation technique du patch ; pas de permission `Workflows: write`. Le step dépend d'un précontrôle réussi. |
| 6. `Publish reviewed PR (never auto-merge)` | Utilise le token éphémère pour pousser `HEAD` sur la branche agent puis crée une PR sur `main` via `gh pr create`, description indiquant la revue humaine et la CI obligatoires. | Permettre une livraison proposée et traçable, sans fusion automatique ni contournement de `Protect Main`. Si le push ou la PR échoue, la publication est incomplète et doit être diagnostiquée. |

**Pourquoi ce job est essentiel :** séparation des privilèges. Un code généré par modèle n'a ni le droit de choisir les fichiers autorisés ni celui de s'attribuer un token GitHub App.

## Effets, sorties et conditions de succès

Le workflow peut créer une branche agent et une PR non fusionnée. Il ne transforme **jamais** seul une tâche `ASF-*` en « livrée ». Après publication, le propriétaire examine le patch, les tests et le required `check` sur le SHA de tête actuel, puis autorise séparément une éventuelle fusion. Les tests du développeur ne remplacent pas cette CI indépendante. La documentation de tâche et l'état GitHub doivent être réconciliés après livraison vérifiée.

## Limites, incidents et futurs changements

- `agent-asf-policy.mjs` possède une **allowlist d'IDs V2 codée en dur** ; rien ici n'active `ASF-V3-*`.
- Les modifications `.github/workflows/`, politique de publication, permissions et protections restent hors portée : les tâches sensibles V2-008/009 ont été livrées par un autre chemin humain.
- Absence de plafond USD garanti ; `@latest` pour OpenCode et gestion des dépendances/PR concurrentes doivent rester examinés au fil de la V3.
- Cette documentation décrit le comportement déclaré par YAML et scripts, **pas** une revalidation payante ou une nouvelle preuve de permissions d'installation.
- La généralisation souhaitée concerne la structure des politiques et les identifiants de phases, jamais le fait de permettre à un agent de modifier sa propre politique ou de fusionner une PR de sécurité.

## Checklist de maintenance pour l'équipe

Vérifier à chaque modification de `agent-asf.yml` que les **3 + 7 + 6 = 16 steps** ci-dessus correspondent aux steps YAML, dans le même ordre, et que chaque changement de `if`, `permissions`, `uses`, variable, chemin, script et frontière de confiance est répercuté ici. Le prochain travail documentaire concerne les cinq autres YAML listés dans [l'inventaire](README.md).
