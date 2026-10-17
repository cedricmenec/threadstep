# Pilote OpenSpec / OpenCode : mode opératoire actuel

**État de référence : 15 octobre 2026.** Voir [l'état courant](current-state.md)
pour les exécutions prouvées, les risques et le prochain test.

## Exécution

Depuis GitHub Actions, lancer manuellement **Agent OpenSpec (manual, staged or auto)**
sur main en renseignant une tâche déjà intégrée au backlog, son mode et son modèle
OpenRouter. La préparation documentaire d'une tâche n'est **jamais** une
autorisation de dépense. Le formulaire propose désormais
`auto_merge=true` pour la PR finale, désactivable avant le lancement.
**La phase `plan` n'est jamais fusionnée automatiquement**, même si cette
option reste cochée. Le workflow refuse la fusion automatique si `main`
n'impose plus le check indépendant obligatoire `check`.
Le ruleset `Protect Main` est actuellement actif et cette vérification
a été éprouvée lors des fusions automatiques #32 et #34.
Voir [la sécurité GitHub](github-autonomy-and-security.md) et
[ASF-WF-002](tasks/ASF-WF-002.md).

**Valeurs pré-sélectionnées dans le formulaire** : phase `auto`, modèle
`openrouter/deepseek/deepseek-v4.1-flash`. Le modèle
`openrouter/z-ai/glm-5.3-flash` reste disponible et les phases `plan`,
`apply`, `finalize` restent sélectionnables. Le formulaire ne déclenche
rien sans action sur « Run workflow ». Avec `auto`, **trois appels OpenCode**
sont prévus (plan, implémentation, sync), sans plafond USD automatique.
Avant de cliquer, vérifier tâche, phase, modèle et coût acceptable.

**Identifiant de tâche raccourci** : entrer `9`, `09`, `009` ou
`TS-009` revient toujours à `TS-009`. Le format canonique `TS-NNN`
continue d'être utilisé dans le backlog, la branche d'agent, le change OPSX
et les commits. Nombres valides de 1 à 999 ; identifiants inexistants refusés
avant tout appel payant. Les autres formats (comme `TS-9` ou `1000`)
sont rejetés pour éviter les ambiguïtés. La validation et la normalisation
ont lieu dans un job de prévalidation séparé, avant installation/usage
d'OpenCode et création du jeton GitHub App du job principal.

Pour empêcher deux exécutions concurrentes du même change avec des
écritures différentes (`9` vs `TS-009`), les runs utilisent un
**verrou de concurrence par tâche canonique**. Les tâches différentes
peuvent s'exécuter simultanément ; pour une même tâche, GitHub peut
remplacer un run encore en attente par un nouveau run du même groupe.
Les exécutions déjà actives ne sont pas annulées.
Le workflow direct `agent.yml` conserve sa propre exécution sans OpenSpec,
et dispose de `auto_merge` activé par défaut, sans preuve E2E de fusion directe.

| Phase | Travail | Appels modèle minimaux | Livraison |
| --- | --- | --- | --- |
| plan | Générer proposal/design/specs/tasks, valider et tester | 1 | PR brouillon, jamais auto-merge |
| apply | Appliquer un plan préexistant, tester, sync, archive | 2 | PR finale, auto-merge conditionnel |
| auto | Plan, validation, implémentation, sync, archive | 3 | PR finale, auto-merge conditionnel |
| finalize | Terminer un change déjà implémenté/commité, sync, archive | 1 | Mise à jour de PR, auto-merge conditionnel |

Ces nombres sont **des appels OpenCode prévus par le workflow**, pas une garantie
sur le nombre de requêtes internes du fournisseur. Aucune limite USD garantie
n'est imposée. Les modèles restent payants et nécessitent l'accord humain
pour chaque lancement. En cas d'ambiguïté métier, préférer plan puis apply,
avec des autorisations séparées.

Une branche d'agent persistante porte le nom agent/openspec/TS-NNN et le
change actif openspec/changes/ts-nnn/. La GitHub App publie la PR avec un jeton
temporaire, et la CI indépendante valide le SHA. L'humain peut désactiver auto-merge pour faire sa propre revue. Sinon,
GitHub ne fusionnera qu'après les checks **effectivement requis** et réussis.
Le script ne se contente pas d'un voyant vert facultatif : il vérifie le
ruleset avant toute demande d'auto-merge.

## Installation d'OpenSpec pour OpenCode

Le paquet npm **@fission-ai/openspec@1.14.1** fournit la CLI. Installer la
CLI ne génère **pas**, à lui seul, les workflows agentiques d'OpenCode.
Depuis la PR #22, les étapes suivantes sont **implémentées et vérifiées en E2E** sur TS-009 (run 38712079641) :

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
pas des sous-commandes de la CLI openspec. Leur compatibilité avec OpenCode
est attestée par la synchronisation MODIFIED TS-009 (PR #26).

Références :
[OpenSpec supported tools](https://github.com/Fission-AI/OpenSpec/blob/main/docs/supported-tools.md),
[OpenSpec commands](https://github.com/Fission-AI/OpenSpec/blob/main/docs/commands.md),
[OpenCode CLI](https://opencode.ai/docs/cli/),
[OpenCode skills](https://opencode.ai/docs/skills/).

## Contrat ASF-OPSX-01 : séparer checklist et recette humaine (17 octobre 2026)

Le [contrat normatif](openspec-checklist-contract.md) distingue désormais :
la checklist `tasks.md`, limitée au travail prouvable sur runner pendant
`apply` **avant** sync/archive ; les vérifications `Manual acceptance`
(navigateur réel, focus, toucher, mobile, visuel, lecteur d'écran) sans
cases ; et `Post-sync review` (diff sémantique après sync, archive,
CI indépendante sur PR, fusion, Pages) sans cases. L'exemple
[OpenSpec tasks.md](examples/openspec-tasks-example.md) matérialise
ce découpage. Les critères humains restent indispensables pour
l'acceptation utilisateur ; l'agent ne doit pas les déclarer exécutés.

Ce contrat est répété dans `AGENTS.md`, `openspec/config.yaml`,
les prompts `plan` et `apply`, avec tests statiques de cohérence.
ASF-OPSX-02 ajoute désormais un rejet mécanique avant `apply` :
les cases de recette humaine explicite, de vérification UI sans moyen
automatisé, d'archive/publication ou logées dans les sections narratives
font échouer `scripts/check-openspec-task-phases.mjs` avec ligne et motif.
Le workflow lance ce garde-fou sur le plan nouvellement créé et sur
les plans persistants avant tout appel d'implémentation OpenRouter.
Ce contrôle est **heuristique**, pas une analyse sémantique exhaustive ;
`plan` puis `apply` avec revue reste préférable à `auto`.
Avant un nouveau run TS-017, relire `tasks.md` en mode `plan`
et ne pas relancer aveuglément un `auto` coûteux. Le run
[#39019660492](https://github.com/cedricmenec/threadstep/actions/runs/39019660492)
n'a pas publié de branche distante ; le code non poussé y est perdu.

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
- Publication uniquement via PR et CI indépendante. `Protect Main`
  impose actuellement `check` avant auto-merge ; la garde de périmètre
  de fichiers n'est pas une sandbox.

Ces contrôles mécaniques ne prouvent **pas** la correction sémantique :
comparer toujours exigences ADDED/MODIFIED/REMOVED/RENAMED avec les anciennes
specs et le comportement implémenté. Les scripts sont intégrés ; la CI de main a réussi après les PR #25 et #26.

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

## Preuves nouvelles : deux auto-merges OpenSpec réussis

Depuis la [PR #29](https://github.com/cedricmenec/threadstep/pull/29),
le formulaire comporte `auto_merge=true` pour les livraisons finales.
Le propriétaire a lancé manuellement les runs payants
[TS-010](https://github.com/cedricmenec/threadstep/actions/runs/38749526539)
et [TS-011](https://github.com/cedricmenec/threadstep/actions/runs/38753301546)
en phase `auto`. Les deux ont réussi, ouvert leur PR et demandé à GitHub
la fusion native différée. Les [PR #32](https://github.com/cedricmenec/threadstep/pull/32)
et [#34](https://github.com/cedricmenec/threadstep/pull/34)
ont été **fusionnées par la GitHub App** après CI indépendante.
La [CI de main](https://github.com/cedricmenec/threadstep/actions/runs/38755434920)
(97 tests Node, Actionlint, OpenSpec) et
[Pages](https://github.com/cedricmenec/threadstep/actions/runs/38755434958)
ont réussi. Les changements OpenSpec sont archivés et leurs
spécifications canoniques `action-removal` et `action-ordering`
sont dans `openspec/specs/`.

Ce parcours prouve la fusion **sur CI verte**, pas le blocage d'une CI
rouge, le mode direct `agent.yml` ni une validation mobile/lecteur
d'écran exhaustive. Les coûts exacts restent à relever chez OpenRouter.

## Vérification suivante

La validation de MODIFIED dans une capacité existante **a été réalisée** :
[run 38712079641](https://github.com/cedricmenec/threadstep/actions/runs/38712079641),
[PR #26](https://github.com/cedricmenec/threadstep/pull/26),
[CI main](https://github.com/cedricmenec/threadstep/actions/runs/38713003608)
et [Pages](https://github.com/cedricmenec/threadstep/actions/runs/38713003743).
Aucun nouveau plan ni apply TS-009 n'est nécessaire. Les scénarios non
démontrés sont REMOVED, RENAMED et les conflits de fusion. La preuve
du coût exact facturé est à chercher chez OpenRouter, non dans ces logs.

**Attention aux PR de plan** : en exécution séquencée, conserver le plan
en PR brouillon jusqu'à apply, puis fusionner la livraison terminée.
La fusion prématurée de la PR #24 a nécessité une reprise, détaillée
ci-dessous, et n'est pas le parcours à répéter.

## Incident TS-009 du 15/10/2026 : checklist de phase impossible

Le [run 38710098331](https://github.com/cedricmenec/threadstep/actions/runs/38710098331)
(apply) a généré les changements de code et obtenu **54 tests réussis**,
mais le garde-fou a rejeté la checklist car la tâche 4.3 demandait à la fois
un contrôle avant sync et un diff après sync. L'agent a correctement laissé
4.3 décochée, le sync n'a pas démarré et aucun commit produit n'a été publié.
La branche persistante agent/openspec/TS-009 a donc reçu une correction de
plan **sans relancer l'agent** : tâche 4.3 limitée au contrôle pré-sync,
puis revue post-sync distincte sans checkbox. Le second
[run 38712079641](https://github.com/cedricmenec/threadstep/actions/runs/38712079641)
a réussi (55 tests, commande OPSX, garde-fou SHA-256, archive) et a publié la
[PR #26](https://github.com/cedricmenec/threadstep/pull/26), depuis fusionnée.
La CI finale sur main a réussi avec 60 tests et Pages est déployé.
Aucun crédit OpenRouter n'est consommé par le nouveau validateur statique,
mais les phases apply et sync elles-mêmes restent payantes.
