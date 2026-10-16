# Backlog ThreadStep

Les besoins versionnés vivent dans `backlog/tasks/TS-NNN.md`, chaque fichier
portant le frontmatter V2 décrit par le
[contrat des tâches V2](../docs/factory/backlog-v2-task-contract.md) et la
[spécification Backlog V2](../docs/factory/specs/backlog-v2.md). Le contrat de
travail des agents figure dans [AGENTS.md](../AGENTS.md), les exigences dans
`docs/product/` et les spécifications canoniques dans `openspec/specs/`.

## Index généré

`backlog/index.json` (tâches actives) et `backlog/archive-index.json`
(historique archivé) sont des **projections générées**, jamais éditées à la
main. La CI les recalcule avec `npm run backlog:check` et refuse toute
divergence. Pour les régénérer volontairement après une migration ou l'ajout
d'une tâche :

```text
npm run backlog:index
```

## Proposer une fonctionnalité

Exprimer le besoin en langage naturel ou vocal. L'assistant examine
la vision, les exigences et les tâches existantes, choisit un TS-NNN
libre, décompose le travail si nécessaire, écrit le périmètre et
les critères d'acceptation, puis fait valider les documents par PR.
Il n'est pas nécessaire de créer une issue GitHub.

## Exécution effective

- **Direct** : workflow Agent (manual, OpenRouter), avec task_id et modèle.
- **OpenSpec** : workflow Agent OpenSpec (manual, staged or auto), avec
  task_id, modèle OpenRouter et phase plan, apply, auto ou finalize.
  Saisie simplifiée : `9`, `009` et `TS-009` sélectionnent la même
  tâche canonique. Le formulaire pré-sélectionne `auto` et DeepSeek V4.1
  Flash, que l'utilisateur peut modifier avant de lancer le run.
  `auto` effectue normalement trois appels OpenCode payants ; il n'existe
  pas encore de plafond USD automatique. Les exécutions du même TS-NNN sont
  sérialisées ; les tâches différentes peuvent tourner en parallèle.
- **Fusion** : les deux workflows proposent `auto_merge=true` par défaut
  pour leurs PR finales, à condition que `main` impose réellement le check
  indépendant `check` ; sinon la demande de fusion échoue sans fusion.
  OpenSpec `plan` reste systématiquement une PR brouillon non fusionnée.
- **Plan puis apply** : plan génère une PR brouillon de spécifications.
  La conserver ouverte pour revue avant d'exécuter apply sur la branche
  persistante, puis fusionner la PR de livraison après CI. Fusionner la
  seule PR de plan prématurément a provoqué l'incident TS-009.
- **Auto** : exécute les phases dans un seul run explicitement déclenché.
- **OPSX** : init des skills/commandes OpenCode, synchronisation via
  opsx-sync, garde-fou des contenus hors openspec/specs/, archive et
  validation stricte. MODIFIED a été éprouvé sur TS-009.
- **Contrat de phase** : les cases de tasks.md doivent toutes être
  réalisables avant sync ; les contrôles post-sync/CI sont distincts.
- La création d'un backlog ne déclenche pas à elle seule d'exécution
  payante. Les workflows n'ordonnancent aucune tâche et ne fusionnent
  jamais de fusion immédiate sans contrôle : seul GitHub peut fusionner
  automatiquement une PR finale après ses contrôles obligatoires.
  Les plafonds de budget restent à implémenter.

## État du backlog

L'état **déclaratif** (type, statut, priorité, automation, risque,
dépendances, date) est porté par le frontmatter de chaque fichier et projeté
dans `backlog/index.json`. La livraison **opérationnelle** (PR fusionnées, CI,
Pages) reste une observation GitHub consignée dans
[docs/factory/current-state.md](../docs/factory/current-state.md) et dans les
sections « Delivery status verification » des tâches : ni un statut Markdown,
ni une case cochée ne prouvent une livraison.

Les tâches historiques `TS-001` à `TS-011` ont été migrées avec
`automation: manual` et `risk: unknown` : elles ne sont jamais sélectionnées
automatiquement, et leurs cases d'acceptation d'origine restent intactes.
`TS-003` relève de la dette factory, hors éligibilité produit. Détails et
incertitudes dans
[docs/factory/backlog-v2-migration.md](../docs/factory/backlog-v2-migration.md).

La prise en main des fonctions livrées est dans
[le guide d'utilisation](../docs/product/guide-utilisation.md).
L'historique de la factory est dans
[docs/factory/current-state.md](../docs/factory/current-state.md).

## Précautions

Conserver des tâches suffisamment petites pour une seule exécution
bornée. Les priorités et dépendances sont déclaratives : il n'y a pas
encore de moteur d'ordonnancement transactionnel. Ne pas relancer une
tâche déjà archivée uniquement pour « tester OPSX ».
