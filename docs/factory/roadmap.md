# Feuille de route de la factory

**Document de planification**, pas déclencheur d'une exécution automatique. Les jalons ci-dessous requièrent explicitement validation et autorisation avant implémentation.

## État vérifié et étapes restantes (15 octobre 2026)

| Jalons | Statut et preuve |
| --- | --- |
| Prototype ThreadStep statique, specs, backlog, `AGENTS.md` | **Fait** : `site/`, `docs/product/`, `backlog/` |
| CI `npm run check` et déploiement Github Pages sur `main` | **Fait** : workflows `.github/workflows/ci.yml`, `pages.yml`, runs réussis |
| Premier run OpenCode/OpenRouter `TS-002` | **Fait** : PR #2 créée, CI après approbation, puis fusionnée le 14 octobre |
| Fonctionnalité `TS-004` par OpenCode/OpenRouter | **Fait** : PR #4 fusionnée, CI et Pages réussis |
| Sélection automatique de tâches et orchestration de vagues | **Non implémenté** |
| Exécution complète OpenSpec (Explore/Propose/Apply/Sync/Archive) dans ThreadStep | **Pilote E2E réalisé** : TS-005, TS-008 (auto) et TS-009 (plan/apply + sync MODIFIED), PR #26 fusionnée |
| GitHub App / auto-merge sécurisé / protection main | **App + CI sur PR vérifiées**. `main` protégée par `Protect Main` avec `check` requis (GitHub Actions, integration_id 15368). ASF-WF-002 prépare l'auto-merge conditionnel, dont le fonctionnement E2E reste à démontrer. |
| Sync OPSX natif et durcissement | **Implémenté et vérifié** : PR #22 (skills, commande, garde-fou SHA-256), run 38712079641 et PR #26 (MODIFIED), PR #25 (contrat de checklist). REMOVED/RENAMED non prouvés. |
| Réconciliation documentaire | **Acquise** : [ASF-DOC-001](tasks/ASF-DOC-001.md), statuts du backlog actualisés après la livraison #26. |
| Ergonomie lancement OpenSpec | **Évolution ASF-WF-001** : auto/DeepSeek V4.1 Flash pré-sélectionnés, alias numériques normalisés via prévalidation et verrou de concurrence par tâche ; tests CI de configuration et du normaliseur, aucun lancement OpenRouter pour cette modification. |

**Dette restante** : les cases historiques d'acceptation dans les tâches TS-NNN ne sont pas cochées automatiquement par l'agent. Leur statut de livraison est désormais réconcilié à partir des PR, sans réécrire a posteriori leurs checklists.

## Étapes proposées, dans cet ordre

### F0. Documenter et figer le pilote [ce dossier]

- Conserver architecture cible, décisions et méthodologie dans `docs/factory/`.
- Maintenir le mode manuel existant et une autorisation explicite par déclenchement payant.
- Vérifier CI sur PR documentaire, puis intégrer après validation.

### F1. Réduire l'intervention GitHub et sécuriser la livraison

- **Acquis** : GitHub App à permissions ciblées pour les PR ; conserver ce mode.
- **Acquis sur TS-008** : une PR créée par la GitHub App déclenche la CI sans approbation supplémentaire ; surveiller ce comportement sur les prochaines PR.
- **Protection faite** : ruleset `Protect Main` actif, suppression et force-push interdits, PR et contrôle `check` requis ; `allow_auto_merge` activé. **À faire** : tester le refus de fusion quand la CI échoue et vérifier la politique d'approbation.
- Valider de bout en bout : création PR automatique → CI sans approbation de démarrage → fusion autorisée selon règles → Pages.
- Tester un cas rouge pour prouver que la PR **ne fusionne pas**.
- **Alternative limitée :** explorer un `workflow_dispatch` de validation ou la promotion fast-forward façon Mestryn ; ne pas les assimiler à un équivalent de required PR checks.

**Définition de terminé F1** : aucune intervention récurrente pour faire démarrer la CI, impossibilité prouvée de fusion si tests échoués, permissions minimales et logs inspectables.

### F2. Adopter OpenSpec comme protocole unique

**Incrément livré** : introduction d'un second workflow manuel
`Agent OpenSpec (manual, staged)`, sans suppression de `agent.yml`. Le run
`plan` produit une PR brouillon ; le run `apply` reprend le même change,
vérifie, synchronise et archive. Voir [mode opératoire](openspec-manual-pilot.md).
TS-005 (#8), TS-008 (#21) et TS-009 (#26) ont démontré les cycles manuels et auto, dont la fusion sémantique MODIFIED. La protection main, les plafonds et les reprises transactionnelles restent à industrialiser.

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
