# Pilote OpenSpec / OpenCode : mode opératoire actuel

**État de référence : 15 octobre 2026.** Voir [l'état courant](current-state.md)
pour les exécutions prouvées, les risques et le prochain test.

## Exécution

Depuis GitHub Actions, lancer manuellement **Agent OpenSpec (manual, staged or auto)**
sur main en renseignant une tâche déjà intégrée au backlog, son mode et son modèle
OpenRouter. La préparation documentaire d'une tâche n'est **jamais** une
autorisation de dépense. Aucune fusion automatique.

| Phase | Travail | Appels modèle minimaux | Livraison |
| --- | --- | --- | --- |
| plan | Générer proposal/design/specs/tasks, valider et tester | 1 | PR brouillon, sans code produit |
| apply | Appliquer un plan préexistant, tester, sync, archive | 2 | PR existante prête pour revue |
| auto | Plan, validation, implémentation, sync, archive | 3 | PR finale pour revue humaine |
| finalize | Terminer un change déjà implémenté/commité, sync, archive | 1 | Mise à jour de PR |

Ces nombres sont **des appels OpenCode prévus par le workflow**, pas une garantie
sur le nombre de requêtes internes du fournisseur. Aucune limite USD garantie
n'est imposée. Les modèles restent payants et nécessitent l'accord humain
pour chaque lancement. En cas d'ambiguïté métier, préférer plan puis apply,
avec des autorisations séparées.

Une branche d'agent persistante porte le nom agent/openspec/TS-NNN et le
change actif openspec/changes/ts-nnn/. La GitHub App publie la PR avec un jeton
temporaire, et la CI indépendante valide le SHA. L'humain fusionne seulement
après contrôle du diff, des specs et des checks.

## Installation d'OpenSpec pour OpenCode

Le paquet npm **@fission-ai/openspec@1.14.1** fournit la CLI. Installer la
CLI ne génère **pas**, à lui seul, les workflows agentiques d'OpenCode.
Cette PR propose l'étape suivante, **non encore vérifiée E2E** :

1. Installer la CLI épinglée puis OpenCode dans le runner éphémère.
2. Exécuter openspec init --tools opencode,agents à la racine.
3. Vérifier .opencode/skills/openspec-sync-specs/SKILL.md,
   .opencode/commands/opsx-sync.md et .agents/skills/openspec-sync-specs/SKILL.md.
4. Ignorer les instructions générées dans .git/info/exclude local au runner ;
   refuser toute mutation de fichiers de projet par init.
5. À la phase sync, invoquer directement **opencode run --command opsx-sync**
   avec l'identifiant de change, au lieu d'un simple prompt évoquant OPSX.

OpenCode reconnaît les skills dans .opencode/skills et .agents/skills.
Les slash commands OPSX sont des **prompts de workflow** propres à l'agent,
pas des sous-commandes de la CLI openspec. Une exécution reste nécessaire
pour établir la compatibilité réelle avec OpenCode et cette version de la CLI.

Références :
[OpenSpec supported tools](https://github.com/Fission-AI/OpenSpec/blob/main/docs/supported-tools.md),
[OpenSpec commands](https://github.com/Fission-AI/OpenSpec/blob/main/docs/commands.md),
[OpenCode CLI](https://opencode.ai/docs/cli/),
[OpenCode skills](https://opencode.ai/docs/skills/).

## Contrôles avant publication

- Validation du plan (plan/auto) ; en auto, commit local du plan avant apply.
- Checklist entièrement cochée, npm run check et validation stricte du change.
- **Contrat de phases** : toutes les cases de `tasks.md` sont des actions
  réalisables par l'agent **avant** le contrôle de checklist et **avant** le
  sync OPSX. Les validations dépendant de la synchronisation, de l'archive ou
  de la CI GitHub doivent figurer dans une rubrique narrative « Post-sync
  review » **sans cases à cocher**, pour revue après exécution.
- L'étape `plan` et l'entrée en `apply` exécutent le validateur léger
  `scripts/check-openspec-task-phases.mjs` pour détecter cette erreur de
  séquencement sans utiliser OpenRouter. Ce détecteur textuel ne remplace pas
  la revue humaine et ne couvre pas toutes les formulations possibles.
- **Avant sync** : prise d'empreinte SHA-256 des fichiers suivis et non suivis
  qui ne sont pas des specs canoniques ; mémorisation du HEAD courant.
- **Après sync** : refuser tout changement de contenu, ajout, suppression,
  changement de mode ou commit hors openspec/specs/. Refuser une sync sans
  effet sur les specs canoniques. Script scripts/sync-guard.mjs.
- Après sync : openspec archive CHANGE --yes --skip-specs pour éviter une
  seconde fusion structurelle, puis validate --all et --archived en mode strict.
- Publication uniquement via PR et CI indépendante. Protection GitHub main
  à configurer séparément ; la garde de périmètre n'est pas une sandbox.

Ces contrôles mécaniques ne prouvent **pas** la correction sémantique :
comparer toujours exigences ADDED/MODIFIED/REMOVED/RENAMED avec les anciennes
specs et le comportement implémenté. Les fichiers/scripts de cette PR
nécessitent revue et CI avant adoption.

## Historique et preuve disponible

- TS-005 : pilote plan/apply (PR #8) fusionné.
- TS-007 : premier auto ayant ignoré deux étapes de contrôle. PR #16 corrige
  les conditions if ; PR #17 ajoute finalize. Ne pas déduire du succès ancien
  que tous les gates ont été exécutés.
- PR #19 : remplacement de la fusion structurelle par un appel de modèle
  guidé par le texte /opsx:sync ; finalize devient payant.
- TS-008 : [run auto 38645900430](https://github.com/cedricmenec/threadstep/actions/runs/38645900430)
  exécuté avec OpenSpec 1.14.1 / OpenCode 1.19.0, 41 tests Node réussis,
  trois appels OpenCode prévus, aucune étape obligatoire skipped, sync puis
  archivage et PR #21 fusionnée. **C'était une création de capacité et une
  instruction de prompt, pas un test du nouveau --command ni une fusion MODIFIED.**

## Vérification suivante

Après fusion de la présente évolution, conduire un test limité sur une capacité
canonique existante (TS-009 est candidat), avec autorisation explicite,
et archiver les résultats : SHA, runs/étapes, version CLI, preuve d'utilisation
du command file/skill, diff avant/après, validations, tests, CI et coût OpenRouter.
Ne jamais relancer une tâche archivée pour simuler ce test.

## Incident TS-009 du 15/10/2026 : checklist de phase impossible

Le [run 38710098331](https://github.com/cedricmenec/threadstep/actions/runs/38710098331)
(apply) a généré les changements de code et obtenu **54 tests réussis**,
mais le garde-fou a rejeté la checklist car la tâche 4.3 demandait à la fois
un contrôle avant sync et un diff après sync. L'agent a correctement laissé
4.3 décochée, le sync n'a pas démarré et aucun commit produit n'a été publié.
La branche persistante agent/openspec/TS-009 a donc reçu une correction de
plan **sans relancer l'agent** : tâche 4.3 limitée au contrôle pré-sync,
puis revue post-sync distincte sans checkbox. Rerun apply possible ; la
présente évolution de factory réduit le risque de reproduction sur les
prochains plans. Aucun crédit OpenRouter n'est consommé par le validateur.
