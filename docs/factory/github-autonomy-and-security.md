# GitHub : suppression des interventions répétitives, sans affaiblir la sécurité

**Historique de l'incident initial du 14/10/2026.** L'exécution OpenCode de `TS-002` a réussi et créé la PR #2, mais sa CI `pull_request` a été créée avec le statut **`action_required`**, sans job lancé, jusqu'à approbation humaine. La CI a ensuite réussi. Ceci est le comportement documenté par GitHub pour les PR générées avec le `GITHUB_TOKEN`.

## 1. Distinguer quatre choses

- **Autoriser les Actions** (`Settings → Actions → General`) permet d'exécuter des workflows.
- **Workflow permissions: Read and write** autorise certains appels GitHub dans les jobs.
- **Allow GitHub Actions to create and approve pull requests** autorise des actions spécifiques du bot, **mais n'annule pas** l'approbation de lancement de CI des PR créées avec `GITHUB_TOKEN`.
- **Approval required** (démarrage des workflows CI sur PR bot) est différent de la **review/approval de la PR** requise par une protection de branche ; supprimer le premier ne supprime pas le second.

## 2. Pourquoi le GITHUB_TOKEN du pilote initial bloquait

GitHub explique qu'une PR créée/mise à jour via le `GITHUB_TOKEN` déclenche les événements `pull_request` en **état d'approbation nécessaire** (`opened`, `synchronize`, `reopened`). La plupart des autres événements produits par ce token n'amorcent pas une nouvelle exécution, pour éviter les boucles. Les exceptions notables sont `workflow_dispatch` et `repository_dispatch`.

**Conséquence :** on ne peut pas obtenir des contrôles CI de PR complètement automatiques simplement en cochant une option dans les settings du dépôt. Ne jamais « résoudre » cette limitation en désactivant la CI.

## 3. Stratégies vérifiées et arbitrage

| Option | Supprime l'approbation de lancement de CI bot ? | Avantages | Limites |
| --- | --- | --- | --- |
| **GitHub App dédiée : recommandée** | **Oui**, lorsque la PR est créée/mise à jour avec le token d'installation de cette App | Scoped à un repo/installation, jetons courts, identité de service indépendante | Création/installation App, clé privée à conserver en secret, permissions à configurer |
| **Fine-grained PAT : alternative pilote** | **Oui**, si les permissions du PAT permettent de créer la PR | Mise en place simple, déclenche les workflows associés à l'événement | Identité liée à un utilisateur, rotation/expiration, périmètre sensible |
| **GITHUB_TOKEN + approbation manuelle** | Non | Historique du pilote initial | Fait obstacle à l'autonomie complète |
| **`GITHUB_TOKEN` + `workflow_dispatch` explicite** | Peut déclencher une **CI séparée** sans approbation liée à une PR bot | Pas de credential supplémentaire, exception officielle GitHub | Conception d'une validation indépendante au bon SHA et publication d'une preuve exigée pour la fusion ; **ne remplace pas automatiquement** les required PR checks |
| **Livraison directe `main` façon Mestryn** | Évite la PR donc évite cette approbation PR | Simplicité, expérience antérieure `DELIVERY: MAIN` | Risque de contourner la review ; la CI de push créée avec `GITHUB_TOKEN` n'est pas déclenchée automatiquement ; branch protection et vérification du SHA indispensables |

La **GitHub App** est le choix cible pour la production d'une PR et la continuité d'une CI GitHub normale. Le PAT finement limité est une solution de transition possible, pas une obligation.

## 4. GitHub App configurée et intégrée (14/10/2026)

1. App créée : `threadstep-software-factory`, App ID `5321746`, installation et exécution sur `threadstep` confirmées par les PR #21 et #26.
2. Donner les permissions minimales nécessaires : `Contents: read/write`, `Pull requests: read/write` ; `Metadata: read` est implicite. Ajouter `Actions: read` uniquement si l'orchestrateur lit les runs via l'App. Ne pas donner de permission globale `Workflows: write` sans besoin explicite et revue.
3. Configuration effectivement utilisée : variable de dépôt **`APP_ID`** et secret **`APP_PRIVATE_KEY`** (clé PEM complète). Le propriétaire a confirmé leur configuration. Ne jamais publier la clé, y compris dans les logs.
4. PR #9 fusionnée : les deux workflows d'agent utilisent `actions/create-github-app-token@v1`, le jeton d'installation pour `git push` et `GH_TOKEN` pour `gh pr create`, `gh pr list`, `gh pr ready`. L'action demande `permission-contents: write` et `permission-pull-requests: write`.
5. Réduire le scope, masquer/révoquer le jeton, limiter sa durée et créer un nouveau jeton si le job dépasse sa validité.
6. **Démontré sur TS-008 et TS-009** : PR #21 et #26 créées par la GitHub App, CI de PR réussies, fusion humaine, puis CI de main et Pages réussies. La protection de main a été configurée ensuite, le 15 octobre.

**Prérequis manuels potentiels** : l'assistant GitHub actuel ne peut pas enregistrer une GitHub App, installer son secret ou modifier toutes les règles de dépôt avec ses opérations disponibles. Ces opérations doivent être réalisées via un outil d'administration autorisé / quelques étapes UI mobile ; aucun secret dans la conversation.

## 5. Protections impératives avant autonomie renforcée

- **Vérifié le 15 octobre** : `main` protégée par le ruleset actif `Protect Main` (PR requise, suppression/force-push bloqués), contrôle `check` désormais obligatoire, source GitHub Actions. Revalider après tout changement administratif.
- Conserver la CI `pull_request` **sans secrets OpenRouter** et sans droits d'écriture. Aucun `pull_request_target` lançant du code issu de PR, aucune chaîne privilégiée `workflow_run` non auditée.
- Vérifier `head SHA` courant, absence de conflit, état et provenance des checks et diff autorisé ; privilégier le merge GitHub respectant les protections.
- **État du 15/10/2026** : `allow_auto_merge=true`, `main` protégée par le ruleset actif `Protect Main` (id 25163425). Une première lecture a détecté la liste de checks obligatoire vide ; lors de la revue de la PR #29, cette configuration a été corrigée. Le required status check `check` avec la source GitHub Actions (integration_id 15368) est désormais présent. La protection de configuration est vérifiée, mais un test E2E de refus sur CI rouge reste à réaliser.
- **Évolution ASF-WF-002** : les deux workflows d'agent proposent `auto_merge=true` par défaut, désactivable à chaque lancement. Ils demandent à GitHub la fusion native différée uniquement après la publication d'une PR finale, et seulement lorsque les conditions suivantes sont vérifiables : repo auto-merge autorisé, `main` protégée, ruleset actif exigeant une PR **et le check `check`**, PR ouverte non brouillon ciblant `main` avec le même head SHA. Sinon, la PR reste ouverte et le workflow échoue explicitement à l'étape de demande d'auto-merge. La phase OpenSpec `plan` est toujours exclue.
- Le mécanisme appelle `gh pr merge --auto --merge --match-head-commit` avec le jeton temporaire GitHub App, **jamais** `--admin` ni une fusion ou un push direct contournant le ruleset. La fusion ne se fera qu'après satisfaction des exigences GitHub ; si un check obligatoire passe au rouge, GitHub doit la bloquer.
- **Action admin déjà réalisée** : [Protect Main](https://github.com/cedricmenec/threadstep/rules/25163425) exige `check`. Vérifier cette exigence régulièrement : le script bloque toute demande de fusion si elle disparaît. Aucun nouveau secret OpenRouter n'est nécessaire.
- Ne pas demander à un bot de « s'approuver » en remplacement d'une review humaine formellement requise. Selon le niveau de risque, conserver review humaine obligatoire.
- Pour la livraison directe à `main`, exiger une autorisation **`DELIVERY: MAIN`** distincte, un commit fast-forward vérifié, aucune protection contournée et une validation indépendante **avant** la promotion. Ne pas compter sur un push `GITHUB_TOKEN` pour déclencher ensuite la CI/Pages.

## 6. Garde-fous pour agents autonomes et dépenses

- OpenRouter : secret `OPENROUTER_API_KEY`, jamais dans code, front public ou artefacts ; liste de modèles autorisés, plafond budgétaire fournisseur et limite de tentatives.
- Approbation de vague bornée (task IDs, modèle, coût maximal, niveau de risque, action de livraison) ; le coût estimé ne peut pas être considéré comme un hard cap sans support côté API/fournisseur.
- Séparer credentials de lecture/code/PR ; les agents générant du code ne disposent pas de permissions pour modifier les workflows d'exécution ou les règles de sécurité.
- Garder un seul agent implémenteur au début, pas de parallélisme aveugle ; limiter timeout, nombre de retries, fréquence et taille des diffs.
- Idempotence, preuves de CI et versions figées des outils/actions dans le modèle industrialisé.
- Toutes les actions dangereuses (`main`, changements de secrets, migrations destructives, règles GitHub) doivent respecter leur politique d'autorisation.

## 7. Documentation officielle vérifiée

**Reprise :** [current-state.md](current-state.md) fait foi pour les preuves récentes et les limites. La synchronisation OPSX guidée par modèle reste non sandboxée ; l'invocation native et le garde-fou SHA-256 ont été validés E2E sur TS-009 (run 38712079641, PR #26). La protection de main reste absente après fusion, selon l'API GitHub.

- [GITHUB_TOKEN et exceptions, PR bot soumises à approbation, alternatives App/PAT](https://docs.github.com/en/actions/concepts/security/github_token)
- [Triggering a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
- [GitHub App dans une Action](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/making-authenticated-api-requests-with-a-github-app-in-a-github-actions-workflow)
- [Action officielle create-github-app-token](https://github.com/actions/create-github-app-token)
- [Branch protection et required checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Avertissements de sécurité workflow_run et pull_request_target](https://cheatsheetseries.owasp.org/cheatsheets/GitHub_Actions_Security_Cheat_Sheet.html)
