# Autonomous Software Factory | Dossier de référence

**Statut : OpenSpec auto TS-010 et TS-011 livrés et fusionnés automatiquement par GitHub App après CI ; agent manuel restauré, Actionlint actif et OPSX natif éprouvé.**  
**Mise à jour : 15 octobre 2026.**  
**Projet pilote :** [ThreadStep](https://github.com/cedricmenec/threadstep).  
**Référence antérieure :** dépôt privé `mestryn`, notamment `.github/workflows/opencode.yml` et `AGENTS.md`.

## Vision

Construire une **usine logicielle générique pilotable par conversation, notamment vocale depuis un téléphone**, capable de passer d'un besoin métier à des spécifications, un backlog, du code testé et une livraison traçable. Le projet applicatif (ThreadStep) est **un pilote**, pas le produit « factory ». Après validation, les composants réutilisables doivent pouvoir être extraits.

Contraintes durables :
- **OpenRouter** fournit les modèles et les dépenses associées, avec une clé en secret GitHub ; **OpenCode** est le moteur pilote mais doit rester remplaçable.
- La spécification et le backlog vivent dans Git, pas seulement dans une conversation ou une issue GitHub.
- **Spec-driven development via OpenSpec** comme protocole cible, incluant Explore, Propose, Apply, vérification, synchronisation des specs et Archive.
- **Deux modes conservés** : **déclenchement manuel ciblé** et **orchestration externe / par vagues**. Ils utilisent exactement la même chaîne d'exécution et de contrôles ; l'orchestrateur est facultatif.
- Le travail est durable, reprenable après interruption, observable, reproductible et limité en coût.
- **Fusion automatique native GitHub et déploiement Pages observés** après CI requise sur TS-010/TS-011 ; l'orchestration externe par vagues reste une cible. Aucun mécanisme ne doit contourner les checks.

**Nouvelle session sans contexte ?** Commencer par
[ChatGPT.md](../../ChatGPT.md), point d'entrée court sur les
responsabilités, autorisations, tâches et PR. Les faits courants
restent dans ce dossier et dans GitHub.

## Où lire quoi ?

1. [État courant et reprise](current-state.md) : preuves, risques, versions et prochaine expérimentation.
2. [Spécification fonctionnelle](functional-specification.md) : acteurs, capacités, scénarios, critères et exigences non fonctionnelles.
3. [Architecture technique](technical-architecture.md) : composants, ports/adaptateurs, contrats, états, stockages et modes d'exécution.
4. [Méthodologie opérationnelle](operating-methodology.md) : de la voix au backlog, du lancement à la livraison, et incidents.
5. [Cycle de développement OpenSpec](openspec-protocol.md) : Explore → Propose → Apply → Verify → Sync → Archive.
6. [Autonomie et sécurité GitHub](github-autonomy-and-security.md) : blocage de CI sur PR créée par bot, GitHub App/PAT, contrôles, budgets, garde-fous.
7. [Feuille de route et critères de passage](roadmap.md) : état confirmé, évolutions et tests de bout en bout.
8. [Décisions et alternatives](decisions.md) : décisions actuelles, options et arbitrages à venir.

## Source de vérité et limites

- Exécution actuelle : agent.yml (direct), agent-openspec.yml (plan/apply/auto/finalize), ci.yml et pages.yml.
- Contrat agent dans AGENTS.md, tâches sous backlog/tasks/, exigences produit sous docs/product/.
- TS-008 (#21) a validé ADDED ; TS-009 (#26) a validé OPSX natif MODIFIED. TS-010 (#32) et TS-011 (#34) ont livré leurs capacités OpenSpec et prouvé le chemin GitHub App → CI indépendante → fusion automatique → Pages.
- PR #25 a rendu explicite le contrat : chaque case de la checklist OpenSpec doit être réalisable avant la synchronisation ; la revue post-sync reste distincte.
- [ASF-DOC-001](tasks/ASF-DOC-001.md) documente la réconciliation du 15 octobre 2026.
- [ASF-DOC-002](tasks/ASF-DOC-002.md) trace la réconciliation après TS-011.
- Le document [current-state.md](current-state.md) sert d'entrée unique pour le statut vérifié. La protection main et le check `check` sont configurés ; l'orchestrateur, les plafonds de coût garantis et les checkpoints transactionnels restent à traiter.
- Les versions des outils, commandes et tarifs peuvent évoluer ; ne jamais déduire la validité du comportement de la seule présence d'un fichier ou de l'état green d'un run.

## Programme ASF V2 : conception et tâches

Les spécifications [Backlog V2, Scheduler V1 et Orchestrator V1](specs/README.md) sont validées pour être découpées en travail de développement, mais **aucune implémentation n'est encore livrée**. Voir le [plan de onze tâches ASF-V2](tasks/ASF-V2-README.md), leurs dépendances et restrictions d'exécution. La préparation du backlog ne constitue pas une autorisation de déclencher OpenRouter ni de fusionner une PR d'implémentation.

[ASF-V2-001](tasks/ASF-V2-001.md) définit le [contrat des tâches V2](backlog-v2-task-contract.md) : frontmatter versionné (`schema_version: 2`), enums, séparation état déclaratif/état GitHub, valeurs par défaut de génération et isolation des règles `TS-NNN`. Ce contrat est documentaire et couvert par des tests statiques. Sa livraison est tracée dans la fiche ([PR #40](https://github.com/cedricmenec/threadstep/pull/40)).

[ASF-V2-002](tasks/ASF-V2-002.md) ajoute l'[index déterministe et le validateur strict](backlog-v2-index.md) (`scripts/asf/`, `backlog/index.json`, `backlog/archive-index.json`, commande `check` intégrée à `npm run check`). L'implémentation est présente sur `main` (PR #43 fusionnée) ; les index restent la seule projection déclarative, sans preuve de livraison.

[ASF-V2-003](tasks/ASF-V2-003.md) migre les tâches historiques `TS-001` à `TS-011` vers le frontmatter V2 sans modifier leur corps, classe `TS-003` en dette factory et régénère `backlog/index.json` (11 fiches actives, `automation: manual`, `risk: unknown`). Détails et incertitudes dans [migration historique](backlog-v2-migration.md). Cette migration est **en revue dans sa propre PR** et ne constitue pas une livraison vérifiée sur GitHub.

[ASF-V2-004](tasks/ASF-V2-004.md) implémente le [noyau pur du scheduler](scheduler-core.md) (`scripts/asf/scheduler/`) : décision déterministe à entrées injectées (instantané validé, manifeste figé, preuves de livraison/conflit, journal), sans réseau, sans horloge et sans mutation. L'implémentation est **en revue dans sa PR** ; couverture par `tests/asf-scheduler-core.test.mjs` et `npm run check` local, sans preuve de CI GitHub indépendante ni de fusion.

[ASF-V2-005](tasks/ASF-V2-005.md) ajoute la [simulation dry-run](scheduler-dry-run.md) (`scripts/asf/scheduler/dry-run.mjs` et `fixtures.mjs`) : inspection du choix du scheduler sans appel OpenRouter, sans dispatch, sans réservation de quota ni écriture de journal. Elle réutilise le noyau, expose candidates, exclusions et ordre potentiel, et distingue preuve de livraison `verified`, état `unknown` (`STOP_UNCERTAIN`, jamais présumé libre) et projection hypothétique non probante. Implémentation **en revue dans sa PR** ; couverture par `tests/asf-scheduler-dry-run.test.mjs` (16 tests) et `npm run check` local, sans preuve de CI GitHub indépendante ni de fusion.

[ASF-V2-006](tasks/ASF-V2-006.md) ajoute le [manifeste immuable, le journal durable et les quotas](wave-manifest-journal.md) (`scripts/asf/waves/`) : manifeste figé et gelé (SHA source, candidates + hash, identité de vague, allowlist de modèle, `max_tasks 1..2`, `openspec`, `auto_merge`, référence d'autorisation), journal append-only à états (`SELECTED` → `DISPATCH_RESERVED` → … → `DELIVERED`, plus `FAILED`/`UNKNOWN`), réservation du quota **avant** dispatch, arrêt au premier échec et stockage durable à comparaison de SHA attendu. Les fenêtres de crash avant/pendant/après dispatch et les conflits de mise à jour sont simulés sans paiement : une issue incertaine produit `STOP_UNCERTAIN` et **jamais** de second dispatch automatique. Implémentation **en revue dans sa PR** ; couverture par `tests/asf-waves-manifest.test.mjs` (9 tests) et `tests/asf-waves-journal.test.mjs` (18 tests) et `npm run check` local (210 tests), sans preuve de CI GitHub indépendante ni de fusion.

[ASF-V2-007](tasks/ASF-V2-007.md) ajoute l'[adaptateur GitHub de vérification des livraisons](delivery-verification.md) (`scripts/asf/github/` et `scripts/asf/delivery/`) : observation GitHub **en lecture seule** qui distingue un run `success` d'une livraison réellement vérifiée. Le verdict pur `verifyDelivery` renvoie `verified` (PR finale fusionnée à la branche/`head SHA`/base `main` attendues, contrôle indépendant `check` prouvé sur le SHA de tête et le commit de fusion, commit présent dans `main`, runs `CI`/`Pages` verts), `pending` (pas encore livré : PR ouverte/brouillon, run ou contrôle manquant) ou `unknown` (erreur API, pagination tronquée, PR ambiguë/concurrente, identité ou SHA divergents, preuve absente). Le client borne la pagination et les timeouts et transforme toute erreur en valeur d'erreur — **jamais** en absence de conflit. Livré mais non archivé satisfait une dépendance. Implémentation **en revue dans sa PR** ; couverture par `tests/asf-github-delivery.test.mjs` (23 tests) et `npm run check` local (233 tests), sans preuve de CI GitHub indépendante ni de fusion.

## Exécuteur ASF dédié (bootstrap)

Voir [l'exécuteur manuel ASF proposé](agent-asf-manual.md) et [ASF-BOOT-001](tasks/ASF-BOOT-001.md). Son statut devient opérationnel uniquement après revue, CI, fusion et vérification sur main. Il accepte les tâches de factory ASF-V2 sans affaiblir le workflow ThreadStep TS-NNN.

## ASF-V2-008 : intégration OpenSpec orchestrée, à confirmer en CI

L'intégration ajoute une entrée réutilisable `workflow_call` pour le futur orchestrateur ASF-V2-009. Elle vérifie un manifeste et un journal à SHA épinglé, le run parent autorisé, une réservation payante et l'empreinte de tâche avant OpenRouter. Un verrou partagé sérialise les jobs payants de trois exécuteurs, sans verrouiller le parent. Voir [ASF-V2-008](tasks/ASF-V2-008.md). Aucune vague payante n'est activée avant l'implémentation et l'autorisation de 009.

## Orchestrateur V1 (ASF-V2-009)

[Mode opératoire Backlog Orchestrator](backlog-orchestrator-manual.md) et [tâche 009](tasks/ASF-V2-009.md). Cette implémentation n'autorise aucun lancement OpenRouter par elle-même ; les prochains essais réels nécessitent une validation distincte.

## Livraison (ASF-V2-010)

[Archiveur déterministe et PR documentaire](agent-asf-archive.md) et [tâche 010](tasks/ASF-V2-010.md). Le noyau pur (`scripts/asf/archive/core.mjs`) archive uniquement les livraisons vérifiées, en une seule PR documentaire, sans cocher les cases historiques ni rendre une tâche `archive_pending` réexécutable. La garde de fusion conserve des familles de branches séparées (`agent/...` vs `asf/archive/...`) et les mêmes prérequis `Protect Main`/`check`. Implémentation **en revue dans sa PR** ; couverture par `tests/asf-archive.test.mjs` (17 tests) et `npm run check` local (265 tests), sans preuve de CI GitHub indépendante ni de fusion. Aucun lancement OpenRouter n'est autorisé par cette tâche.
