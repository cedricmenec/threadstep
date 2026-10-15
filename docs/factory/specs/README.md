# ASF : Backlog V2, Scheduler V1 et Orchestrator V1

**Statut :** architecture approuvée pour découpage, non implémentée.  
**Version :** 0.1  
**Date :** 16 octobre 2026  
**Dépôt pilote :** https://github.com/cedricmenec/threadstep

## Objectif

Faire évoluer l'Autonomous Software Factory vers une orchestration de vagues **déclenchées explicitement, bornées et séquentielles**. La sélection des tâches est déterministe et indépendante des modèles IA. Le moteur OpenSpec existant conserve la responsabilité d'une tâche et de sa PR.

## Documents

1. [01-backlog-v2.md](01-backlog-v2.md) : contrat de tâche, métadonnées, indexation, génération et archivage.
2. [02-scheduler-v1.md](02-scheduler-v1.md) : éligibilité, dépendances, classement et sélection dynamique.
3. [03-orchestrator-v1.md](03-orchestrator-v1.md) : vague, autorisation, exécution, livraison, reprise et archivage.

## Décisions acquises dans les échanges

- Une nouvelle tâche porte `automation: allowed` par défaut, sauf exception motivée ; l'absence du champ sur une tâche historique ne vaut **pas** autorisation.
- Une spécification complète peut être introduite directement en `status: ready` dans la PR documentaire. La fusion validée dans `main` la rend candidate à une vague ultérieure, mais **n'autorise aucun appel payant**.
- Le lancement d'une vague peut être direct (`execute`) ; `dry-run` est facultatif. Un périmètre et des limites sont figés au lancement.
- Le scheduler recalcule la prochaine tâche après **chaque livraison réellement vérifiée**, sans ajouter de nouvelles tâches au périmètre figé.
- Quota V1 : **maximum deux déclenchements de tâches payantes par défaut**, comptabilisés avant l'appel, sans retries payants automatiques, un seul développement simultané et arrêt au premier échec.
- Une tâche n'est pas livrée simplement parce que son workflow a réussi : il faut vérifier la PR, le SHA, les contrôles et la fusion selon la politique de livraison.
- L'archivage des tâches livrées est automatisé par une PR **documentaire**, regroupée en fin de vague, soumise à CI et protections de `main`. Un archivage en attente ne rend jamais la tâche réexécutable.
- Aucune modification directe de `main`, aucun contournement de `Protect Main`, aucune modification de secrets sans autorisation dédiée.

## Arbitrages techniques proposés (pas encore approuvés séparément)

- V1 limitée aux tâches **produit** à risque faible ; les tâches de factory, les risques moyens/élevés et les cas non qualifiés nécessitent une autre politique explicite.
- Priorité décroissante, ancienneté puis identifiant comme départage ; règles exactes dans Scheduler V1.
- Journal d'exécution persistant sur une branche Git dédiée par vague, à éprouver avec des scénarios de crash et d'accès concurrent.
- Appels `workflow_dispatch` de l'exécuteur depuis l'orchestrateur via une GitHub App disposant des droits appropriés, après évolution contrôlée de l'authentification du workflow enfant.
- Temps d'attente, modalités d'auto-merge documentaire et format des preuves à éprouver en dry-run et en tests d'intégration.

## Sources existantes à respecter

- [`AGENTS.md`](https://github.com/cedricmenec/threadstep/blob/main/AGENTS.md)
- [`ChatGPT.md`](https://github.com/cedricmenec/threadstep/blob/main/ChatGPT.md)
- [`docs/factory/current-state.md`](https://github.com/cedricmenec/threadstep/blob/main/docs/factory/current-state.md)
- [`docs/factory/roadmap.md`](https://github.com/cedricmenec/threadstep/blob/main/docs/factory/roadmap.md)
- [`backlog/tasks/TS-003.md`](https://github.com/cedricmenec/threadstep/blob/main/backlog/tasks/TS-003.md)
- [`agent-openspec.yml`](https://github.com/cedricmenec/threadstep/blob/main/.github/workflows/agent-openspec.yml)

Ces propositions ne constituent **ni une autorisation de modifier le dépôt, ni une autorisation de lancer OpenRouter, ni une autorisation de fusionner des PR**.