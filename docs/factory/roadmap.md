# Feuille de route de la factory

## Bilan actualisé — 16 octobre 2026

- ASF-V2-001 à ASF-V2-011 : **implémentées et fusionnées**, avec des preuves réelles pour l'orchestration V1 ; l'ancien tableau « non implémenté » ci-dessous est **historique**.
- Pilote réel **1/1** : [run 38886939283](https://github.com/cedricmenec/threadstep/actions/runs/38886939283), PR #55.
- Pilote réel **2/2** : [run 38910657187](https://github.com/cedricmenec/threadstep/actions/runs/38910657187), PR #58 et #59, contrôle intermédiaire des checks de PR/fusion/CI/Pages.
- Prochain jalon de recette : [test CI rouge réel et contrôle permissions](validation-and-recovery.md), puis signature de clôture ASF-V2-011. Recette utilisateur [ThreadStep](../product/acceptance-checklist.md).
- Évolutions optionnelles : archivage documentaire réel de TS-012/013/014 (une livraison n'est pas un archivage), métriques de budget, et [architecture V2 jusqu'à dix démarrages](scale-to-ten.md). Aucune extension payante ou sensible n'est autorisée par la roadmap.

**Les lignes datées du 15 octobre ci-dessous restent le journal des objectifs initiaux, et non l'état en service.**


**Document de planification**, pas déclencheur d'une exécution automatique. Les jalons ci-dessous requièrent explicitement validation et autorisation avant implémentation.

## État vérifié et étapes restantes (15 octobre 2026)

| Jalons | Statut et preuve |
| --- | --- |
| Prototype ThreadStep statique, specs, backlog, `AGENTS.md` | **Fait** : `site/`, `docs/product/`, `backlog/` |
| CI `npm run check` et déploiement Github Pages sur `main` | **Fait** : workflows `.github/workflows/ci.yml`, `pages.yml`, runs réussis |
| Premier run OpenCode/OpenRouter `TS-002` | **Fait** : PR #2 créée, CI après approbation, puis fusionnée le 14 octobre |
| Fonctionnalité `TS-004` par OpenCode/OpenRouter | **Fait** : PR #4 fusionnée, CI et Pages réussis |
| Sélection automatique de tâches et orchestration de vagues | **Non implémenté** |
| Exécution complète OpenSpec (Explore/Propose/Apply/Sync/Archive) dans ThreadStep | **Pilote E2E réalisé** : TS-005, TS-008, TS-009 et **TS-010/TS-011 en auto** (#32/#34 fusionnées) |
| GitHub App / auto-merge sécurisé / protection main | **App + CI sur PR vérifiées**. `main` protégée par `Protect Main` avec `check` requis (GitHub Actions, integration_id 15368). ASF-WF-002 est opérationnel : auto-merge via GitHub App prouvé sur PR #32 et #34, après CI `check`. Le refus sur CI rouge et le mode direct restent à tester. |
| Sync OPSX natif et durcissement | **Implémenté et vérifié** : PR #22 (skills, commande, garde-fou SHA-256), run 38712079641 et PR #26 (MODIFIED), PR #25 (contrat de checklist). REMOVED/RENAMED non prouvés. |
| Réconciliation documentaire | **Actualisée** : [ASF-DOC-001](tasks/ASF-DOC-001.md) (TS-009) puis [ASF-DOC-002](tasks/ASF-DOC-002.md) (TS-010/011 et fusion conditionnelle). |
| Ergonomie lancement OpenSpec | **Évolution ASF-WF-001** : auto/DeepSeek V4.1 Flash pré-sélectionnés, alias numériques normalisés via prévalidation et verrou de concurrence par tâche ; tests CI de configuration et du normaliseur, aucun lancement OpenRouter pour cette modification. |
| Contrat des tâches Backlog V2 | **Livré** : [ASF-V2-001](tasks/ASF-V2-001.md) (PR #40) définit le [contrat des tâches V2](backlog-v2-task-contract.md) et ses tests statiques. |
| Index et validation stricte du backlog | **Livré sur `main`** : [ASF-V2-002](tasks/ASF-V2-002.md) fournit `scripts/asf/`, `backlog/index.json`, `backlog/archive-index.json` et l'[index déterministe](backlog-v2-index.md) (PR #43 fusionnée). Migration [ASF-V2-003](tasks/ASF-V2-003.md) **en revue dans sa PR** : frontmatter V2 des tâches historiques et index peuplé (11 actives), détails dans [migration historique](backlog-v2-migration.md). |
| Noyau pur du scheduler | **En revue dans sa PR** : [ASF-V2-004](tasks/ASF-V2-004.md) fournit le [noyau pur du scheduler](scheduler-core.md) (`scripts/asf/scheduler/`) à entrées injectées, sans réseau, horloge ni mutation, avec 30 tests dédiés et `npm run check` local (167 tests). Aucune CI GitHub indépendante ni fusion revendiquée ; CLI dry-run et adaptateurs à venir (ASF-V2-005/006/007). |
| Simulation dry-run du scheduler | **En revue dans sa PR** : [ASF-V2-005](tasks/ASF-V2-005.md) ajoute la [simulation dry-run](scheduler-dry-run.md) (`scripts/asf/scheduler/dry-run.mjs` + `fixtures.mjs`) qui réutilise le noyau, expose candidates/exclusions/ordre et distingue preuve vérifiée, état inconnu (`STOP_UNCERTAIN`) et projection hypothétique, sans appel payant ni dispatch, avec 16 tests dédiés et `npm run check` local (183 tests). Aucune CI GitHub indépendante ni fusion revendiquée. |
| Manifeste immuable, journal durable et quotas | **En revue dans sa PR** : [ASF-V2-006](tasks/ASF-V2-006.md) fournit le [manifeste figé, le journal append-only et les quotas](wave-manifest-journal.md) (`scripts/asf/waves/`) : réservation du quota avant dispatch, arrêt au premier échec, stockage durable à comparaison de SHA attendu et `STOP_UNCERTAIN` sans second dispatch sur issue incertaine. Fenêtres de crash et conflits simulés sans paiement ; 9 + 18 tests dédiés et `npm run check` local (210 tests). Aucune CI GitHub indépendante ni fusion revendiquée. |
| Adaptateur GitHub de vérification des livraisons | **En revue dans sa PR** : [ASF-V2-007](tasks/ASF-V2-007.md) fournit l'[observation GitHub en lecture seule](delivery-verification.md) (`scripts/asf/github/` et `scripts/asf/delivery/`) : verdict pur `verified`/`pending`/`unknown`, corrélation tâche/run/PR/branche/`head SHA`/base, `check` indépendant sur tête et fusion, runs post-fusion `CI`/`Pages`, pagination et timeouts bornés, erreur API jamais lue comme absence de conflit. Livré mais non archivé satisfait une dépendance ; 23 tests dédiés et `npm run check` local (233 tests). Aucune CI GitHub indépendante ni fusion revendiquée. |
| Recette E2E progressive et mise en service contrôlée | **En revue dans sa PR, recette simulée seulement** : [ASF-V2-011](tasks/ASF-V2-011.md) fournit la [recette E2E](e2e-validation.md) (`scripts/asf/fixtures/e2e.mjs`, `tests/asf-e2e-validation.test.mjs`) : 6 scénarios déterministes non payants (backlog vide, dépendance débloquée, fenêtres de crash, CI rouge simulée, vague à deux tâches, accès concurrent) qui réutilisent les modules purs et prouvent `paidCalls=0`/`dispatches=0`. Les phases **payantes** (pilote à une tâche, vague à deux tâches, CI rouge réel) et la vérification du ruleset/`check`/permissions App restent **non exécutées** et exigent une autorisation propriétaire distincte. Aucune CI GitHub indépendante ni fusion revendiquée. |

**Dette restante** : les cases historiques d'acceptation dans les tâches TS-NNN ne sont pas cochées automatiquement par l'agent. Leur statut de livraison est désormais réconcilié à partir des PR, sans réécrire a posteriori leurs checklists.

## Étapes proposées, dans cet ordre

### F0. Documenter et figer le pilote [ce dossier]

- Conserver architecture cible, décisions et méthodologie dans `docs/factory/`.
- Maintenir le mode manuel existant et une autorisation explicite par déclenchement payant.
- Vérifier CI sur PR documentaire, puis intégrer après validation.

### F1. Réduire l'intervention GitHub et sécuriser la livraison

- **Acquis** : GitHub App à permissions ciblées pour les PR ; conserver ce mode.
- **Acquis sur TS-008** : une PR créée par la GitHub App déclenche la CI sans approbation supplémentaire ; surveiller ce comportement sur les prochaines PR.
- **Protection faite** : ruleset `Protect Main` actif, suppression et force-push interdits, PR et contrôle `check` requis ; `allow_auto_merge` activé. **À faire** : tester le refus de fusion quand la CI échoue, le mode direct et les cas de conflit.
- Valider de bout en bout : création PR automatique → CI sans approbation de démarrage → fusion autorisée selon règles → Pages.
- Tester un cas rouge pour prouver que la PR **ne fusionne pas**.
- **Alternative limitée :** explorer un `workflow_dispatch` de validation ou la promotion fast-forward façon Mestryn ; ne pas les assimiler à un équivalent de required PR checks.

**Définition de terminé F1** : aucune intervention récurrente pour faire démarrer la CI, impossibilité prouvée de fusion si tests échoués, permissions minimales et logs inspectables.

### F2. Adopter OpenSpec comme protocole unique

**Incrément livré** : introduction d'un second workflow manuel
`Agent OpenSpec (manual, staged)`, sans suppression de `agent.yml`. Le run
`plan` produit une PR brouillon ; le run `apply` reprend le même change,
vérifie, synchronise et archive. Voir [mode opératoire](openspec-manual-pilot.md).
TS-005 (#8), TS-008 (#21) et TS-009 (#26) ont démontré les cycles manuels et auto, dont la fusion sémantique MODIFIED. La protection main est active et l'auto-merge OpenSpec a été prouvé sur #32/#34 ; les plafonds et les reprises transactionnelles restent à industrialiser.

- **Acquis** : OpenSpec 1.14.1 et skills/commandes OpenCode générés dans le runner, usage E2E démontré sur TS-009 ; **reste** : épingler OpenCode (@latest actuellement).
- Introduire `openspec/`, choisir le schéma `spec-driven`, associer `TS-NNN` à des changes déterministes.
- Étape autonome Explore/Propose/validation des artefacts ; puis Apply + tests + checkpoints; Sync des specs ; Archive non interactif + validation finale.
- Tester un changement comportemental simple avec artefacts conservés, preuves de tests et un change correctement archivé.
- **Conserver le workflow manuel `task_id`** comme première entrée ; ne pas dépendre du futur orchestrateur pour OpenSpec.

**Définition de terminé F2** : des tests E2E prouvent que les exigences OpenSpec et le code livré concordent, que `openspec/specs` est actualisé et qu'une archive existe.

### F3. Industrialiser le moteur réutilisable

- Définir un contrat de tâche et un résultat commun aux modes manuel/externe ; extraire des workflows réutilisables / une action dédiée.
- Idempotence : branch existante, PR existante, retries et checkpoints distants ; intégrer les mécanismes éprouvés de Mestryn.
- Centraliser mesures de coût, limites par run, logs, vérifications de diff et politiques de livraison.
- Tester crash/reprise, branche divergente, secrets manquants, tâche introuvable, tests en échec, limites atteintes.

**Définition de terminé F3** : mêmes règles OpenSpec et mêmes verdicts en mode manuel et en appel API ; reprise sans duplication.

### F4. Ajouter un orchestrateur externe **optionnel**

- Parser de backlog, priorités et dépendances ; états persistés, acquisition des tâches et verrous.
- UI/API/ordonnanceur externe déclenchant le **même moteur** par `workflow_dispatch` ou `repository_dispatch`.
- Vagues bornées et autorisées explicitement, une tâche en cours à la fois, pause/reprise, reporting.
- Préserver le lancement manuel si le service d'orchestration est absent ou en panne.

**Définition de terminé F4** : une vague de deux tâches dépendantes s'enchaîne sans manipulation manuelle et s'arrête sur un check rouge ; le même lot reste lançable tâche par tâche manuellement.

### F5. Généraliser hors de ThreadStep

- Séparer règles factory et configuration de projet ; démarrer une autre app depuis le seul contrat de task.
- Vérifier isolation des dépôts, modèles, clés/budgets et permissions App.
- Publier un guide d'initialisation et un parcours mobile pour l'activation initiale.

### Prochain test borné

Le test **TS-009 MODIFIED est terminé** : commande OPSX native, garde-fou, spécification canonique modifiée, archive, CI et Pages ont été vérifiés ([run 38712079641](https://github.com/cedricmenec/threadstep/actions/runs/38712079641)). Préparer une tâche séparée pour REMOVED, RENAMED ou des conflits sémantiques, après autorisation du run. Ne pas rejouer TS-009 pour cela. Un reporting de coût fiable reste à concevoir. Voir [current-state.md](current-state.md).

## Décisions non prises

- Repo central de factory ou workflows réutilisables seulement.
- Politique d'auto-merge par défaut et catégories nécessitant impérativement une review humaine.
- GitHub App dédiée au compte ou par organisation ; PAT de transition ou non.
- Format machine-readable de dépendances/priorités et moteur d'état à long terme.
- Politique de synchro issue GitHub ↔ Markdown : Markdown demeure l'autorité.
- Cap de coût OpenRouter réellement enforceable, selon fonctionnalités disponibles du fournisseur.

## Précaution

L'accord sur la feuille de route n'est pas une autorisation d'activer une exécution agentique, de créer une GitHub App ou de modifier des secrets/règles de branche. L'implémentation future exige la décision correspondante.

## Bootstrap de l'exécution ASF (proposition en PR, non livrée)

- [ ] ASF-BOOT-001 : ajouter un agent dédié de factory, lancé manuellement pour ASF-V2-001..011, séparant travail OpenCode non privilégié et publication GitHub App après validation du diff. Voir [mode opératoire](agent-asf-manual.md).
- [ ] CI et Actionlint réussis sur la PR bootstrap, fusion explicitement autorisée, tests post-fusion vérifiés.
- [ ] Premier run payé ASF-V2-001 seulement après nouvelle autorisation du propriétaire.

## Précontrôle de livraison ASF : correctif proposé

- [x] Réconcilier ASF-V2-001 après fusion réelle et CI (PR #41).
- [ ] Livrer ASF-BOOT-002 : contrôle GitHub déterministe des dépendances sans synchronisation documentaire bloquante, avec tests d'erreurs et CI indépendante.
- [ ] Poursuivre avec ASF-V2-002 uniquement après autorisation d'un nouveau lancement OpenRouter.

Note de statut (non cochée) : la PR d'implémentation ASF-V2-002
(`scripts/asf/`, index `backlog/index.json` / `backlog/archive-index.json`,
`check` intégré à `npm run check`) est présente sur `main` via la PR #43. La
migration [ASF-V2-003](tasks/ASF-V2-003.md) est en revue dans sa propre PR :
preuves locales (`npm run check` → 137 tests, `backlog:check` 11 actifs,
0 archivé, `node --check` sur `site/core.js` et `site/app.js`) et **aucune**
revendication de CI GitHub indépendante ni de fusion.
