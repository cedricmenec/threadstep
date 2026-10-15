# ASF-DOC-002 | Réconcilier la factory après auto-merge TS-010 et TS-011

Status: completed
Date: 2026-10-15
Scope: documentation de la Software Factory, architecture et historiques des tâches
Priority: high
Execution: documentation-only, sans OpenRouter ni OpenSpec

## Objectif

Mettre en cohérence la documentation avec la livraison autonome
effectivement observée après les PR #29 à #34 : restauration de
l'agent manuel, CI Actionlint et auto-merge natif conditionné à GitHub.
Distinguer les succès E2E, les protections statiques et les tests
non réalisés.

## Réalisation et critères

- [x] Vérifier sur GitHub les PR #29 et #30, le ruleset Protect Main,
  la CI Actionlint, les exécutions agents de TS-010/011, les PR
  fusionnées par le bot et le déploiement Pages.
- [x] Mettre à jour current-state.md, la page d'entrée et la roadmap,
  avec références et limites actuelles.
- [x] Réconcilier ADR-016, la spécification fonctionnelle, l'architecture
  technique, le mode opératoire OpenSpec, les exigences de sécurité
  et l'architecture du pilote.
- [x] Clore les métadonnées historiques ASF-WF-001/002/003 avec les
  preuves effectivement obtenues, sans inventer un test de CI rouge.
- [x] Conserver les incidents TS-009 (checklist) et PR #29 (YAML)
  comme leçons historiques, mais marquer leur remédiation comme livrée.
- [x] Maintenir les risques ouverts : pas d'orchestrateur de vagues,
  pas de plafond de coût OpenRouter garanti, OpenCode @latest,
  pas de checkpoints transactionnels, opérations OPSX REMOVED/RENAMED
  non vérifiées, mobile/a11y sans recette manuelle complète.
- [x] Distinguer auto-merge observé sur le workflow OpenSpec
  (TS-010/11) et **absence d'essai E2E de fusion du workflow direct**.
- [x] Limiter les changements aux documents Markdown, sans modification
  d'exécution, de sécurité, de secret, de code ni de schéma.
- [x] Vérifier CI de PR avant fusion documentaire autorisée.

## Preuves

- [PR #29](https://github.com/cedricmenec/threadstep/pull/29) :
  ajout de l'option auto_merge.
- [PR #30](https://github.com/cedricmenec/threadstep/pull/30) :
  correction de l'agent manuel et ajout d'Actionlint et bash -n.
- [OpenSpec auto TS-010](https://github.com/cedricmenec/threadstep/actions/runs/38749526539),
  [PR #32](https://github.com/cedricmenec/threadstep/pull/32) :
  run réussi et fusion GitHub par la GitHub App.
- [OpenSpec auto TS-011](https://github.com/cedricmenec/threadstep/actions/runs/38753301546),
  [PR #34](https://github.com/cedricmenec/threadstep/pull/34) :
  run réussi et fusion GitHub par la GitHub App.
- [CI main](https://github.com/cedricmenec/threadstep/actions/runs/38755434920) :
  97 tests Node, Actionlint et validation OpenSpec réussis.
- [Pages](https://github.com/cedricmenec/threadstep/actions/runs/38755434958) :
  publication réussie.

## Hors périmètre

Rejouer les workflows d'agent, activer une permission API,
modifier la configuration GitHub, produire un reporting de coût
ou changer la politique d'auto-merge.
