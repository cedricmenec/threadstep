# Feuille de route de la factory

**Document de planification**, pas déclencheur d'une exécution automatique. Les jalons ci-dessous requièrent explicitement validation et autorisation avant implémentation.

## État du pilote vérifié (14 octobre 2026)

| Jalons | Statut et preuve |
| --- | --- |
| Prototype ThreadStep statique, specs, backlog, `AGENTS.md` | **Fait** : `site/`, `docs/product/`, `backlog/` |
| CI `npm run check` et déploiement Github Pages sur `main` | **Fait** : workflows `.github/workflows/ci.yml`, `pages.yml`, runs réussis |
| Premier run OpenCode/OpenRouter `TS-002` | **Fait** : PR #2 créée, CI après approbation ; PR conservée ouverte comme témoin |
| Fonctionnalité `TS-004` par OpenCode/OpenRouter | **Fait** : PR #4 fusionnée, CI et Pages réussis |
| Sélection automatique de tâches et orchestration de vagues | **Non implémenté** |
| Exécution complète OpenSpec (Explore/Propose/Apply/Sync/Archive) dans ThreadStep | **Non implémenté** |
| GitHub App / auto-merge sécurisé / protection `main` | **Non configurés** ; branche `main` non protégée à la vérification |

**Attention aux artefacts historiques** : `backlog/tasks/TS-004.md` indique encore `ready` et ses checkboxes ne sont pas actualisées par le workflow pilote ; prévoir une synchronisation automatique de l'état une fois le cycle OpenSpec introduit.

## Étapes proposées, dans cet ordre

### F0. Documenter et figer le pilote [ce dossier]

- Conserver architecture cible, décisions et méthodologie dans `docs/factory/`.
- Maintenir le mode manuel existant sans activation de nouvelles dépenses.
- Vérifier CI sur PR documentaire, puis intégrer après validation.

### F1. Réduire l'intervention GitHub et sécuriser la livraison

- Démontrer GitHub App ou PAT à permissions minimales pour émission de PR, de préférence **GitHub App**.
- Supprimer le statut `action_required` sur une **nouvelle PR de test** tout en maintenant la CI indépendante.
- Protéger `main`, sélectionner les checks obligatoires, vérifier la politique d'approbation de review et de merge ; configurer `allow_auto_merge` uniquement si souhaité/possible.
- Valider de bout en bout : création PR automatique → CI sans approbation de démarrage → fusion autorisée selon règles → Pages.
- Tester un cas rouge pour prouver que la PR **ne fusionne pas**.
- **Alternative limitée :** explorer un `workflow_dispatch` de validation ou la promotion fast-forward façon Mestryn ; ne pas les assimiler à un équivalent de required PR checks.

**Définition de terminé F1** : aucune intervention récurrente pour faire démarrer la CI, impossibilité prouvée de fusion si tests échoués, permissions minimales et logs inspectables.

### F2. Adopter OpenSpec comme protocole unique

- Fixer version CLI, config et Skills OpenSpec (profils Explore/Propose/Apply/Sync/Archive + Verify).
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

## Décisions non prises

- Repo central de factory ou workflows réutilisables seulement.
- Politique d'auto-merge par défaut et catégories nécessitant impérativement une review humaine.
- GitHub App dédiée au compte ou par organisation ; PAT de transition ou non.
- Format machine-readable de dépendances/priorités et moteur d'état à long terme.
- Politique de synchro issue GitHub ↔ Markdown : Markdown demeure l'autorité.
- Cap de coût OpenRouter réellement enforceable, selon fonctionnalités disponibles du fournisseur.

## Précaution

L'accord sur la feuille de route n'est pas une autorisation d'activer une exécution agentique, de créer une GitHub App ou de modifier des secrets/règles de branche. L'implémentation future exige la décision correspondante.
