# Backlog de développement ASF V2

**Actualisation opérationnelle du 16 octobre 2026 : les onze tâches ASF V2 ont été implémentées et fusionnées.** La recette technique d'une puis deux tâches réelles a réussi ([runs](../validation-and-recovery.md)). **Ne pas interpréter l'ancien statut de planification ci-dessous comme la vérité GitHub.** Les tests de CI rouge réelle et la revue sécurité de clôture demeurent ouverts.


**Statut :** découpage de conception approuvé, tâches prêtes pour revue documentaire, aucune implémentation ni exécution autorisée.

Références : [Backlog V2](../specs/backlog-v2.md), [Scheduler V1](../specs/scheduler-v1.md), [Orchestrator V1](../specs/orchestrator-v1.md).

Chaque tâche ci-dessous est **une PR distincte** de factory, avec contrôles indépendants, mise à jour documentaire dans la même PR et validation explicite de fusion. Les tâches sont liées par leurs dépendances ; la priorité n'annule jamais une dépendance.

## Backlog V2

| Tâche | Livrable | Prérequis |
| --- | --- | --- |
| [ASF-V2-001](ASF-V2-001.md) | Contrat des tâches V2 et génération par défaut | Aucun |
| [ASF-V2-002](ASF-V2-002.md) | Index déterministe et validation stricte du backlog | ASF-V2-001 |
| [ASF-V2-003](ASF-V2-003.md) | Migration historique du backlog sans rupture | ASF-V2-002 |

## Scheduler V1

| Tâche | Livrable | Prérequis |
| --- | --- | --- |
| [ASF-V2-004](ASF-V2-004.md) | Noyau pur du scheduler | ASF-V2-002, ASF-V2-003 |
| [ASF-V2-005](ASF-V2-005.md) | Simulation dry-run et explication des décisions | ASF-V2-004 |

## Orchestrator V1

| Tâche | Livrable | Prérequis |
| --- | --- | --- |
| [ASF-V2-006](ASF-V2-006.md) | Manifeste immuable, journal durable et quotas | ASF-V2-004 |
| [ASF-V2-007](ASF-V2-007.md) | Adaptateur GitHub de vérification des livraisons | ASF-V2-006 |
| [ASF-V2-008](ASF-V2-008.md) | Voie OpenSpec orchestrée authentifiée et verrous | ASF-V2-006, ASF-V2-007 |
| [ASF-V2-009](ASF-V2-009.md) | Workflow GitHub Actions Backlog Orchestrator | ASF-V2-005, ASF-V2-006, ASF-V2-007, ASF-V2-008 |

## Livraison

| Tâche | Livrable | Prérequis |
| --- | --- | --- |
| [ASF-V2-010](ASF-V2-010.md) | Archiveur déterministe avec PR documentaire | ASF-V2-002, ASF-V2-003, ASF-V2-007, ASF-V2-009 |
| [ASF-V2-011](ASF-V2-011.md) | Validation E2E progressive et mise en service contrôlée | ASF-V2-008, ASF-V2-009, ASF-V2-010 |

## Contraintes de démarrage

- Les workflows existants `agent-openspec.yml` et `agent.yml` sont des exécuteurs de tâches produit TS-NNN, **pas** des exécuteurs de tâches ASF-V2 ; ils interdisent la modification des chemins internes de la factory. Ne pas essayer de les détourner pour implémenter ces tâches.
- Un agent ASF autorisé devra agir sur une branche dédiée et une PR de revue ; ses permissions sur les chemins sensibles feront l'objet d'un contrôle spécifique.
- Tout run OpenRouter payant exige une nouvelle autorisation expresse. Aucun de ces documents ne déclenche un workflow.
- Les simulations et tests de sécurité précèdent les essais réels. Les essais payants de ASF-V2-011 sont séparément autorisés run par run.
- Les tâches TS-003 et les anciennes tâches produit ne sont pas automatiquement migrées en nouvelles autorisations d'exécution.
