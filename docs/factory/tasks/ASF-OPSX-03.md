# ASF-OPSX-03/04 | Checkpoints durables et reprise contrôlée OpenSpec

Date : 2026-10-17
Type : factory
Automation : manual
Risk : high
Status : implémenté sur branche de PR, CI indépendante et fusion à vérifier
Cause : [TS-023 run #39047805814](https://github.com/cedricmenec/threadstep/actions/runs/39047805814)

## Constat et objectif

Sur TS-023, plan et apply étaient réussis, 444 tests passaient, OPSX sync
avait modifié les specs et l'archive locale existait. La validation globale
strict échouait sur une exigence de plus de 500 caractères. Le job s'est
terminé sans push ni PR : le runner éphémère a perdu le travail.

Conserver un plan validé et une implémentation vérifiée **sur la branche
distante**, puis reprendre une phase sans répéter la précédente. Respecter les
contrôles de portée, le coût explicite, la CI obligatoire et la sécurité.

## Checklist d'implémentation ASF, dans la même PR

- [x] Checkpoint de plan : après validation stricte du change, vérification de
  l'absence de changements hors `openspec/changes/ts-nnn/`, commit et push
  non forcé de `agent/openspec/TS-NNN`, y compris en mode auto ; jamais de
  PR/auto-merge avant la phase de publication existante.
- [x] Checkpoint après apply : recontrôle de l'immuabilité du plan, de toutes
  les cases `tasks.md`, de `npm run check` et `openspec validate` ; portée
  de fichiers autorisés, commit et push **avant** l'appel OPSX payant.
- [x] Contrôle strict des specs canoniques **après sync et avant archive**,
  sans affaiblir `--strict` ni supprimer les exigences. Échec : archive et
  publication interdites, checkpoint d'implémentation distant conservé.
- [x] Enrichir le fichier de commande OPSX généré sur le runner, non suivi
  par Git, pour demander explicitement des exigences atomiques, prose cible
  <=400 caractères et scénarios pour exemples/détails ; revérifier en strict.
- [x] Refuser de régénérer un plan déjà existant par `plan`/`auto` ;
  conseiller `apply` après lecture. Un checkpoint d'apply permet
  `finalize`, sous une **nouvelle autorisation payante**.
- [x] Afficher en cas d'échec le dernier checkpoint confirmé, SHA, branche,
  run et procédure de reprise dans le résumé Actions, sans exporter prompt
  ou clé d'authentification.
- [x] Ajouter des tests Node pour le contrôle de portée et les séquences
  plan → checkpoint → apply → checkpoint → sync → strict → archive → PR,
  ainsi que l'héritage des appels OpenSpec du Backlog Orchestrator V1.
- [x] Documenter les opérations dans `docs/factory/`, le risque et les
  limites ; ne modifier ni secrets, ni permissions GitHub App, ni protection
  de main, ni quotas, ni politique de retry.
- [ ] Vérifier la CI GitHub `check` indépendante + Actionlint sur le SHA
  exact de cette PR avant la fusion explicitement autorisée.
- [ ] Contrôler la fusion et les CI/Pages de `main` après publication.

## Reprise vérifiable

Si un plan a été publié, son commit est visible sur
`agent/openspec/TS-NNN` : inspecter les artefacts puis lancer
`phase=apply` avec une autorisation de coût distincte.
Si apply est sauvegardé mais OPSX échoue, **ne pas rejouer apply** :
inspecter le commit, la checklist et les différences puis lancer
`phase=finalize` explicitement autorisé. Un retry du run initial
(`auto`) n'est pas une reprise ; il est volontairement interdit de
régénérer un plan déjà présent.

Les nouveaux checkpoints sont des commits/push distants **et non des
artifacts Actions**. La branche de produit reste une branche d'agent,
jamais une publication sur `main`. Un plan seul ou un apply checkpoint
ne vaut ni PR finale, ni livraison, ni recette humaine.

## Limites et validation

Les tests statiques valident la construction et les invariants, **pas**
un nouveau parcours OpenRouter facturé ; aucun modèle payant n'est lancé
par la présente PR. Le nombre maximum de démarrages et l'arrêt entre
tâches de Backlog Orchestrator V1 restent inchangés. Aucun retry
automatique payant n'a été ajouté. Un échec pendant le modèle avant
le checkpoint suivant peut perdre les changements non encore poussés.
Les erreurs de GitHub App ou de `git push` restent bloquantes.

La validation de type "long requirement" dépend d'OpenSpec 1.14.1 ;
la consigne de longueur est une prévention, pas une garantie de sortie
du LLM. Les tests humains, les modifications de spec `REMOVED` et
`RENAMED`, et une vraie injection de crash de runner restent à tester
séparément.
