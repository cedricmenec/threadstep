# Guide développeur — Autonomous Software Factory (ASF V2)

## Choix du modèle OpenCode et appels invisibles

**Incident ASF-MODEL-001 (20 octobre 2026).** Le seul argument `opencode run --model` ne borne pas les appels de l'agent interne `title` : sans `small_model`, OpenCode peut choisir un modèle OpenRouter non sélectionné, y compris Google Nano Banana. Voir [fiche et preuves ASF-MODEL-001](tasks/ASF-MODEL-001.md).

Les workflows `Agent OpenSpec` (plan/apply/OPSX sync, y compris sous l'orchestrateur V1) et `Agent` direct doivent **avant toute phase payante** charger `scripts/asf/opencode-model-policy.mjs` depuis `origin/main`, non depuis une branche `agent/*`. Cette politique échoue si le modèle n'est pas dans la liste contrôlée des entrées GitHub Actions, configure `OPENCODE_CONFIG_CONTENT` avec `model` et `small_model` identiques, et désactive `agent.title`. Elle évite la génération automatique de titres et tout choix implicite du modèle auxiliaire.

Lors d'un ajout de modèle dans l'UI GitHub Actions, mettre à jour simultanément l'allowlist du script et les **trois** workflows d'entrée, puis exécuter `npm run check`. Ne jamais exposer `OPENROUTER_API_KEY`, ni autoriser un modèle depuis une branche agent non vérifiée. Cette politique ne remplace pas le contrôle financier du fournisseur ni la future épingle d'une version d'OpenCode ; aucun run OpenRouter n'est lancé par les tests de cette correction.

**Clôture ASF V2 : 16 octobre 2026, périmètre V1 borné.** Le programme ASF-V2-001 à ASF-V2-011 est livré ; vrais pilotes 1/2 tâches, vrai blocage GitHub du `check` rouge (PR #61), protections vérifiées par API et permissions App/recette produit attestées par le propriétaire. Pas d'injection de panne réelle dans un agent payant. Voir [rapport de clôture](closeout-2026-10-16.md), [validation/reprise](validation-and-recovery.md) et [preuves](current-state.md).

## Démarrage rapide

1. Lire `AGENTS.md`, `ChatGPT.md`, [l'état vérifié](current-state.md) et les [règles GitHub](github-autonomy-and-security.md). Ne jamais se fier à un ancien statut Markdown pour déterminer si une tâche a été réellement livrée.
2. Utiliser Node **22+**, installer les dépendances nécessaires de l'environnement et exécuter :

   ```sh
   npm run check
   node scripts/asf/fixtures/e2e.mjs
   node --test tests/asf-e2e-validation.test.mjs
   ```

   `npm run check` lance la suite Node (`tests/*.test.mjs`), le contrôle déterministe des index et la vérification syntaxique des deux modules applicatifs. La CI GitHub ajoute ses propres validations (notamment Actionlint et OpenSpec). Ne pas présenter une commande non lancée comme réussie.
3. Pour une nouvelle fonctionnalité : créer une fiche `backlog/tasks/TS-NNN.md` avec `schema_version: 2`, tests prévus, critères observables et `product / ready / allowed / low` **uniquement si** le risque et la préparation sont réellement caractérisés. Puis `npm run backlog:index` et `npm run check`, PR documentaire, CI et fusion autorisée.
4. Pour implémenter : l'utilisateur autorise séparément `workflow_dispatch` (agent manuel ou orchestrateur). **Aucune fiche de backlog ne constitue une autorisation de dépense**.

## Carte des composants

| Couche | Fichiers | Responsabilité |
| --- | --- | --- |
| Contrat du backlog | `backlog/tasks/`, `scripts/asf/yaml.mjs`, `backlog-index.mjs`, `backlog-cli.mjs` | Valider frontmatter V2, dépendances, cycles et index de hashes |
| Scheduler déterministe | `scripts/asf/scheduler/core.mjs`, `dry-run.mjs`, `fixtures.mjs` | Classer, exclure et sélectionner depuis un snapshot et des preuves injectés ; aucune dépense |
| Manifeste, journal, quotas | `scripts/asf/waves/manifest.mjs`, `journal.mjs`, `hash.mjs`, `store.mjs` | Geler les candidates et leurs empreintes, réserver avant dispatch, consigner transitions, rejeter mutations concurrentes |
| Adaptateur GitHub | `scripts/asf/github/`, `scripts/asf/delivery/` | Vérifier identité, PR/SHAs, `check` indépendant, fusion, CI et Pages ; toute ambiguïté bloque |
| Orchestrateur réel | `scripts/asf/waves/orchestrate.mjs`, `.github/workflows/backlog-orchestrator.yml` | Owner-only, `prepare`, une/two tâches, `settle` après chaque livraison |
| Authentification exécuteur | `scripts/asf/waves/authenticate-executor.mjs`, `.github/workflows/agent-openspec.yml` | Vérifier manifeste, branche, run parent, réservation, quota et droits avant les phases payantes |
| OpenSpec/OpenCode | `.github/workflows/agent-openspec.yml`, `openspec/specs/`, `openspec/changes/archive/` | Explorer, proposer, appliquer, tester, synchroniser et archiver les exigences |
| Mode agent direct | `.github/workflows/agent.yml` | Exécution ciblée manuelle sans OpenSpec |
| Mode agent ASF | `.github/workflows/agent-asf.yml`, `scripts/agent-asf-policy.mjs` | Maintenance factory sensible dans son chemin autorisé, avec revue humaine |
| Archiveur | `scripts/asf/archive/` | Planifier/produire une PR documentaire pour des tâches déjà prouvées livrées ; le noyau n'est **pas** le workflow d'archivage autonome après chaque vague |
| CI/Pages | `.github/workflows/ci.yml`, `pages.yml` | Tests indépendants, validations, puis site statique depuis `main` |

L'architecture est **à séparation nette** : ThreadStep est l'application pilote ; la factory ne dépend pas des règles `TS-NNN` sauf à son adaptateur produit. Les chemins `ASF-V2-NNN` restent manuels et protégés.

## Chaîne d'une vague V1

1. `workflow_dispatch` propriétaire sur `main` avec `mode=dry-run` ou `execute`, `max_tasks=1|2`, modèle approuvé et `auto_merge`.
2. `prepare` contrôle la source GitHub, les PR conflictuelles, les fiches et les preuves. En dry-run, il émet une décision sans token d'écriture, modèle, réservation ou branche. En execute, il produit `asf/waves/wave-<run_id>/manifest.json` et `journal.json`, réserve une place puis autorise l'exécuteur.
3. `first` appelle le workflow réutilisable OpenSpec en `phase=auto` et publie une PR finale. L'auto-merge demande à GitHub la fusion *seulement après* required `check`. La CI ne doit jamais être contournée.
4. `after_first` attend une PR fusionnée dont l'identité et les SHA correspondent, un `check` de PR **et** de commit fusionné, puis les runs post-fusion `CI` et `Pages` réussis. Interrogation toutes les **15 secondes** pendant **7 minutes au plus**. Échec, absence de preuve ou expiration => arrêt, jamais un second dispatch.
5. Si `max_tasks=2` et qu'une candidate valide subsiste dans le **manifeste gelé**, réservation puis `second` ; `after_second` contrôle également toute la livraison et ferme le journal.

Le journal garde `SELECTED`, `DISPATCH_RESERVED`, `EXECUTING`, `PR_PUBLISHED`, `CI_PENDING`, `MERGE_PENDING`, `DELIVERED` ainsi que les états d'échec/incertitude. **Une livraison vérifiée peut encore être active dans le backlog**, sans que cela implique un nouveau dispatch : GitHub et le journal font foi. L'archivage par PR est une capacité distincte ; ne pas déclarer automatiquement archivées TS-012/13/14.

## Garanties et limites

- V1 : **1 ou 2 démarrages au plus**, **1 développement payant simultané**, **0 retry payant automatique**. `max_tasks` limite les départs et **pas** les dollars OpenRouter. Le modèle `auto` peut invoquer OpenCode/OpenRouter plusieurs fois par tâche.
- Snapshot initial figé (IDs, empreintes, SHA Git) : un nouveau backlog ou un brief modifié n'élargit jamais une vague existante.
- Token GitHub App limité aux jobs qui en ont besoin. Secrets interdits dans les PR et journaux. Ruleset `Protect Main` et required `check` à revérifier en cas de modification des protections.
- Verrou `threadstep-paid-development-v1` partagé avec les agents manuels ; ne pas lancer de tâches parallèles pour accélérer la recette.
- Aucune réparation automatique d'un journal `UNKNOWN`, aucune relance aveugle, aucun `gh pr merge --admin`. Voir [procédure de reprise](validation-and-recovery.md).
- Passer à 10 tâches nécessite une **V2 explicite** de l'orchestrateur, pas un simple changement de formulaire : [analyse de capacité](scale-to-ten.md).

## Preuves de qualification

- [Run 38881470174](https://github.com/cedricmenec/threadstep/actions/runs/38881470174) : dry-run sans travail.
- [Run 38884052693](https://github.com/cedricmenec/threadstep/actions/runs/38884052693) : dry-run sélection TS-012.
- [Run 38886939283](https://github.com/cedricmenec/threadstep/actions/runs/38886939283), [PR #55](https://github.com/cedricmenec/threadstep/pull/55) : première livraison réelle 1/1.
- [Run 38903288406](https://github.com/cedricmenec/threadstep/actions/runs/38903288406) : dry-run `max_tasks=2`.
- [Run 38910657187](https://github.com/cedricmenec/threadstep/actions/runs/38910657187), [PR #58](https://github.com/cedricmenec/threadstep/pull/58) et [#59](https://github.com/cedricmenec/threadstep/pull/59) : deux livraisons séquentielles, CI et Pages réussies.
- Les cas de panne **simulés** sont répertoriés dans [la recette E2E](e2e-validation.md). Le test d'une **CI réellement rouge** n'a pas été réalisé ; il reste un critère distinct.

## Références

[Spécifications](specs/README.md) · [Référentiel des onze tâches](tasks/ASF-V2-README.md) · [Mode opératoire](backlog-orchestrator-manual.md) · [État et limites](current-state.md) · [Architecture technique](technical-architecture.md).
