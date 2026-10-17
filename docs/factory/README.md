# Autonomous Software Factory — documentation de référence

**État : 16 octobre 2026.** Le programme ASF-V2-001 à ASF-V2-011 est **livré sur `main`**. La V1 a exécuté et livré **une tâche** (TS-012) puis **deux tâches** (TS-013/TS-014) dans une même vague, avec PR, CI et Pages indépendamment vérifiés. **ASF V2 clôturée dans son périmètre V1** : test `check` rouge réel bloquant la fusion GitHub effectué (PR #61), ruleset vérifié et permissions/recette manuelle confirmées par le propriétaire. Les essais de panne interne à un agent payant restent non exécutés : [rapport de clôture](closeout-2026-10-16.md). Une checklist ancienne non cochée ne transforme pas une livraison vérifiée en échec, mais ne constitue pas non plus la preuve du test manquant.

## Pour commencer

| Besoin | Guide |
| --- | --- |
| Comprendre les composants, le code et les contrôles | [Guide développeur ASF](developer-guide.md) |
| Vérifier l'état, les SHAs, PR et runs de référence | [État courant](current-state.md) |
| Exécuter un dry-run ou une vague V1 | [Mode opératoire de l'orchestrateur](backlog-orchestrator-manual.md) |
| Consulter la décision formelle de clôture | [Rapport ASF V2 du 16 octobre 2026](closeout-2026-10-16.md) |
| Comprendre les checkpoints et la reprise après sync | [ASF-OPSX-03/04](tasks/ASF-OPSX-03.md), [procédure d'incident](validation-and-recovery.md) et [qualité OPSX](opsx-sync-quality.md) |
| Tester panne, CI rouge, permissions et reprise | [Recette finale et reprise](validation-and-recovery.md) |
| Consulter le backlog de préparation ASF V3 (plafond envisagé 10 à 15 tâches) | [Backlog ASF V3 proposé](tasks/ASF-V3-README.md) |
| Comprendre les verrous techniques du passage de deux à dix puis quinze | [Étude de changement d'échelle](scale-to-ten.md) |
| Consulter les critères ASF-V2-001 à 011 | [Backlog ASF V2](tasks/ASF-V2-README.md) |
| Spécifications de Backlog V2, Scheduler V1, Orchestrator V1 | [Spécifications](specs/README.md) |
| Schémas d'architecture et contrats | [Architecture technique](technical-architecture.md) |
| Autorisations et sécurité GitHub | [GitHub et règles de fusion](github-autonomy-and-security.md) |
| OpenSpec manuel et protocole OPSX | [Agent OpenSpec](openspec-manual-pilot.md), [contrat et précontrôle ASF-OPSX-01/02](openspec-checklist-contract.md) et [protocole](openspec-protocol.md) |
| Historique des choix et feuille de route | [Décisions](decisions.md) et [roadmap](roadmap.md) |
| Application pilote ThreadStep | [Guide utilisateur](../product/guide-utilisation.md), [guide développeur](../product/developer-guide.md) et [recette](../product/acceptance-checklist.md) |

À chaque session, commencer par [ChatGPT.md](../../ChatGPT.md) et [AGENTS.md](../../AGENTS.md) ; ces fichiers portent le contrat de sécurité, pas les preuves opérationnelles. Les faits de livraison doivent être recoupés avec GitHub.

## Programme ASF V2 et preuves

| Lot | Composants livrés | Preuve |
| --- | --- | --- |
| ASF-V2-001 à 003 | Contrat YAML, index/validation, migration historique TS-001..011 | PR #40, #43, #44 |
| ASF-V2-004 à 007 | Scheduler pur, dry-run, manifeste/journal/quotas, adaptateur GitHub | PR #45, #46, #47, #48 |
| ASF-V2-008 à 009 | Sécurité OpenSpec orchestrée et workflow de vagues | PR #49 et #50, réalisations sensibles réconciliées via #51 |
| ASF-V2-010 | Archiveur déterministe / PR documentaire | PR #52 |
| ASF-V2-011 | Simulations E2E, tests et documentation du protocole de recette | PR #53 |
| Validation réelle V1 | TS-012 : une tâche ; TS-013/014 : deux tâches séquentielles | [run #38886939283](https://github.com/cedricmenec/threadstep/actions/runs/38886939283) + [run #38910657187](https://github.com/cedricmenec/threadstep/actions/runs/38910657187), PR #55/#58/#59, CI et Pages |

Voir les pages de module existantes (`backlog-v2-*.md`, `scheduler-*.md`, `wave-manifest-journal.md`, `delivery-verification.md`, `agent-asf-archive.md`, `e2e-validation.md`) pour les détails du code produit *à l'époque de leur première PR*. Leurs en-têtes historiques peuvent parler de « PR en revue » ou de « preuve locale » ; **la présente page et l'état actuel GitHub prévalent pour le statut opérationnel**.

## Limites de la version opérationnelle

- `max_tasks=1|2` seulement, avec **un développement payant à la fois**. Le formulaire n'accepte pas dix tâches ; modifier le seul formulaire casserait le contrat sécurisé.
- `execute` est un acte de dépense explicitement autorisé par le propriétaire. **Aucun plafond USD garanti** n'existe dans la V1 ; chaque tâche peut générer plusieurs appels OpenRouter.
- L'auto-merge est **natif GitHub**, et ne doit pas contourner le `check` indépendant ; le contrôle post-fusion exige CI et Pages avant le prochain slot.
- L'archiveur ASF-V2-010 est une capacité de planification/PR indépendante ; les trois nouvelles tâches produits demeurent dans l'index actif tant qu'aucun archivage réellement réalisé n'est observé.
- Le journal sur la branche `asf/waves/wave-<run_id>` ne doit jamais être modifié manuellement comme si un échec pouvait être réinitialisé sans danger.
- Les six scénarios de panne **simulés** sont en place ; la CI rouge réelle a bloqué la PR #61. La recette manuelle et les permissions GitHub App ont été attestées par le propriétaire le 16 octobre 2026, sans journal technique matériel ni capture sensible. Voir [clôture](closeout-2026-10-16.md).

## Vision

ThreadStep est **une application pilote**, non la factory elle-même. L'ASF cherche à transformer un besoin exprimé en conversation en backlog versionné, code testé et livraison traçable. Le stockage des exigences reste dans Git ; OpenSpec et OpenCode forment la chaîne du pilote, OpenRouter est le fournisseur de modèles, GitHub Actions et la GitHub App assurent l'exécution et la livraison sous contrôle. Les règles produit `TS-NNN` ne doivent pas être confondues avec les tâches protégées `ASF-V2-NNN`.
