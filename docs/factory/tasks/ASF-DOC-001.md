# ASF-DOC-001 | Réconcilier la documentation après TS-009

Status: completed
Priority: high
Date: 2026-10-15
Scope: factory documentation and existing task status metadata only
Execution: no OpenRouter run, no application or workflow change

## Objectif

Faire correspondre la documentation opérationnelle et le backlog de
`cedricmenec/threadstep` à l'état effectivement vérifié après les
PR #22, #23, #24, #25 et #26. Les changements historiques restent traçables.

## Critères d'acceptation et réalisation

- [x] Vérifier sur GitHub les merges #25 et #26, la CI du SHA de main
  et le déploiement Pages après TS-009.
- [x] Mettre à jour la page d'accueil de la factory et
  `current-state.md` avec les preuves TS-009 et les limites réelles.
- [x] Réconcilier méthodologie, protocole OpenSpec, pilote manuel,
  architecture, sécurité, décisions et feuille de route en séparant
  état actuel, historique et cible.
- [x] Expliciter le contrat de phase des checklists et la reprise
  après une PR plan fusionnée trop tôt.
- [x] Réconcilier le sommaire du backlog et le statut des tâches
  effectivement livrées, sans prétendre que les anciennes cases
  d'acceptation ont été cochées rétroactivement par un agent.
- [x] Préserver les exigences produit et les archives OpenSpec.
- [x] Préserver les risques : `main` non protégée, coûts non plafonnés
  techniquement, OpenCode installé via `@latest`, opérations OPSX
  `REMOVED` et `RENAMED` non démontrées.
- [x] Maintenir l'historique des run failures et leur remédiation.
- [x] Limiter le diff aux documents Markdown ; aucune mutation du
  produit, des tests, de la configuration, des workflows ou des secrets.
- [x] Faire valider la PR par la CI indépendante avant fusion.

## Preuves de référence

- [PR #22](https://github.com/cedricmenec/threadstep/pull/22) : skills,
  invocation native et garde-fou de périmètre.
- [PR #25](https://github.com/cedricmenec/threadstep/pull/25) : contrat
  de phase et tests pré-sync.
- [PR #26](https://github.com/cedricmenec/threadstep/pull/26) : TS-009.
- [Run apply TS-009](https://github.com/cedricmenec/threadstep/actions/runs/38712079641) :
  commande `opsx-sync`, garde-fou, archive, 55 tests.
- [CI main](https://github.com/cedricmenec/threadstep/actions/runs/38713003608) :
  60 tests, succès.
- [Pages](https://github.com/cedricmenec/threadstep/actions/runs/38713003743) :
  déploiement réussi.
- `main` : `322fcf2137c52b470d7fafa4e25095b8c119562c`
  au démarrage de cette tâche.

## Hors périmètre

Refonte du protocole, modification des garde-fous, provisionnement des
règles de protection GitHub, suivi réel de dépenses OpenRouter,
lancement d'un nouveau change, fusion du code produit.
