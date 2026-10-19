# ASF-OPSX-07 | Autoriser les scripts produit TS-039 sans ouvrir les scripts ASF

Date : 2026-10-19  
Type : factory  
Automation : manual  
Risk : high  
Status : correctif proposé dans une PR dédiée ; CI, fusion et recette à vérifier  
Incident : [TS-039, run #39169388706](https://github.com/cedricmenec/threadstep/actions/runs/39169388706)  
Checkpoint durable : `agent/openspec/TS-039` au SHA `7a895bd5110544fcc45780b98e42ea2914f4317d` (**plan seul**).

## Diagnostic et décision

L'exécution OpenSpec de TS-039 a produit des tests réussis lors d'`apply`, mais le checkpoint pré-OPSX a rejeté `scripts/product/e2e-matrix.mjs` avec `Checkpoint has forbidden paths`. La liste des tâches du **plan approuvé** demande explicitement ce module produit. Dans `scripts/agent-openspec-checkpoint.mjs`, `PROTECTED_PREFIXES` bloque `scripts/` tout entier, malgré le contrat ASF-OPSX-06 « code et tooling produit autorisés ; scripts ASF protégés ».

Correction **strictement limitée** au préfixe `scripts/product/` pendant `apply` et `publish`. Les chemins `scripts/asf/`, `scripts/agent-openspec-checkpoint.mjs`, `scripts/sync-guard.mjs` et tous les autres `scripts/*` demeurent bloqués. La phase `plan` reste confinée au change OpenSpec ; les specs et archives gardent les protections de phase. Les chemins mal formés, secrets, clés et artefacts temporaires restent interdits partout. Aucune modification de permission ou workflow n'est nécessaire.

## Checklist de revue de la PR factory

- [x] Le code définit **un seul préfixe positif** `scripts/product/`, sans autoriser globalement `scripts/` ou les scripts sensibles.
- [x] `apply` et `publish` acceptent `scripts/product/e2e-matrix.mjs`; `plan` le refuse encore.
- [x] Les tests vérifient refus de `scripts/asf/`, des garde-fous de checkpoint/sync, des workflows, des chemins OpenSpec d'autres tâches, secrets et traversées.
- [x] Le script reste chargé depuis `origin/main` et appelé avant/après staging ; aucune modification du YAML ASF ni des workflows.
- [x] Documentation de récupération et preuve de périmètre ajoutées à `docs/factory/validation-and-recovery.md`.
- [ ] CI indépendante `check` réussie **sur le SHA exact** de la PR, et protection `main` vérifiée.
- [ ] Fusion sous les protections de `main`, CI de `main` et Pages vérifiées.
- [ ] Reprise de TS-039 approuvée **séparément** ; après nouvelle exécution, checkpoint `apply` vérifié, sync, PR finale, puis recette humaine.

## Sécurité, exclusions et reprise

Cette PR ne modifie **ni** `agent/openspec/TS-039` **ni** les artefacts OpenSpec, n'essaie pas de relancer `apply`, n'appelle aucun modèle payant et n'accède à aucune donnée personnelle. Elle ne change pas `AGENTS.md`, les secrets ou la protection GitHub.

Après fusion **seulement**, vérifier que le workflow TS-039 charge la politique corrigée depuis le nouveau `origin/main` et que la branche distante `agent/openspec/TS-039` pointe toujours vers son checkpoint de plan. Toute reprise de `phase=apply` est un **nouveau coût** exigeant autorisation expresse ; ne pas utiliser `auto` ni « Re-run failed jobs ». Les sorties de l'ancien runner, non checkpointées, ne sont pas réputées récupérables.

## Limites

Les tests de politique valident le chemin autorisé et les interdictions, pas le bon fonctionnement d'un futur script E2E ni des synchronisations réelles Android/laptop. La revue du code produit et la recette TS-039 restent nécessaires. Les scripts produit exécutables demeurent à examiner comme toute contribution de code.
