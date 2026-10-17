# AGENTS.md : séparer contrat de coding et exigences produit

**Décision du 17 octobre 2026.** Révision explicite et autorisée du
contrat agent, dans une PR distincte des développements applicatifs.

## Problème et résolution

L'ancien `AGENTS.md` proscrivait « No backend, database service,
account, authentication », fixait `localStorage` et refusait les
bibliothèques JS tierces. Il recopiait ainsi les restrictions du
MVP en règles universelles de coding, devenues contradictoires avec
les tâches Dexie Cloud TS-024 à TS-030.

Désormais, `AGENTS.md` décrit **comment** l'agent agit :
permissions, sécurité, branches, checklist OpenSpec, vérification,
publication et reprise ; il ne décide pas **ce que** le produit
doit faire. Il ne donne aucune autorisation implicite d'utiliser
un service tiers ou d'étendre le périmètre fonctionnel.

## Responsabilités documentaires

| Source | Responsabilité |
| --- | --- |
| [AGENTS.md](../../AGENTS.md) | Instructions/mode opératoire du coding agent, garde-fous et preuves. |
| [ChatGPT.md](../../ChatGPT.md) | Accueil, préparation du backlog, niveau d'autorisation. |
| [Vision](../product/vision.md), [MVP](../product/mvp.md), [guide produit](../product/developer-guide.md) | Cible du produit et baseline historique ; distinguer ce qui est livré et projeté. |
| [Spécification Dexie Cloud](../product/specs/dexie-cloud-local-first.md), [plan de migration](../product/dexie-cloud-rollout.md) | Exigences normatives du chantier cloud, migration, confidentialité et recette. |
| [Backlog](../../backlog/README.md), [contrat V2](backlog-v2-task-contract.md) | Tâches, périmètres, qualification, dépendances et éligibilité. |
| [Contrat checklist](openspec-checklist-contract.md), [reprise](validation-and-recovery.md) | Contraintes de workflow, checkpoints et diagnostics vérifiables. |

## Sécurité et exclusions inchangées

- Ne pas publier secrets, jetons d'administration, clés OpenRouter ni
  données personnelles dans le code, le site public, les logs et les PR.
- Ne pas pousser sur `main`, contourner le check indépendant ou
  auto-fusionner une PR de plan OpenSpec.
- Ne pas changer les fichiers de factory à partir d'une tâche produit
  ordinaire. Une évolution factory requiert sa propre PR et autorisation.
- Préserver le stockage local et les exports historiques, avec
  consentement et migration sûre avant transmission au cloud.
- Les sept tâches Dexie restent `proposed` et `automation: manual` ;
  leur création n'autorise **aucun appel OpenRouter payant, aucune
  exécution automatique et aucune fusion de code**.

## Tâche documentaire de cette PR

- [x] Réécrire AGENTS.md autour des seules consignes d'exécution.
- [x] Replacer les décisions de périmètre dans la vision, le MVP
  historique et le guide produit, sans affirmer une livraison Dexie.
- [x] Mettre à jour le cadrage des TS-024 à TS-030 : lever le faux
  veto d'agent, conserver les risques et préconditions réels.
- [x] Aligner le guide de session et la documentation ASF avec
  la séparation des sources de vérité.

**Validation :** modification documentaire seulement, sans
`site/`, workflow, script, secret, ni code agent payé.
La CI vérifiera les contrats automatisés ; aucun test
Dexie Cloud, OTP ni migration réelle n'est revendiqué.
