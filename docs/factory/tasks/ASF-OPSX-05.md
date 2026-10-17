# ASF-OPSX-05 | Checkpoint Dexie et reprise depuis le plan TS-024

Date : 2026-10-17
Type : factory
Automation : manual
Risk : high
Status : correction en PR, CI et fusion à vérifier
Incident : [run TS-024 #39070773239](https://github.com/cedricmenec/threadstep/actions/runs/39070773239)

## Cause et périmètre

TS-024 a validé plan, apply, 476 tests et OpenSpec strict. Avant OPSX sync,
son checkpoint a été refusé pour `.gitignore`, `package.json`,
`package-lock.json` et `tools/vendor-dexie.mjs`, nécessaires au
packaging local des dépendances cloud. Seul le plan est durable :
`agent/openspec/TS-024` au SHA `b9a2edc2`.

Le contexte `openspec/config.yaml` portait encore un veto du MVP
sur authentification et dépendances, contredisant la [PR #107](https://github.com/cedricmenec/threadstep/pull/107)
et le contrat produit actualisé. L'ancienne branche garde également
une copie datée des scripts de la factory : la politique de checkpoint
doit provenir du `main` de l'exécution, pas des fichiers potentiellement
anciens ou modifiés par l'agent de la tâche.

## Checklist documentaire/implémentation de la PR de correction

- [x] Élargir la whitelist de checkpoint apply aux quatre chemins
  exacts sans permettre `tools/*`, `scripts/*`, fichiers factory ou secrets.
- [x] Charger le garde-fou depuis `origin/main` avant appel payant,
  afin de protéger les reprises depuis des branches plus anciennes.
- [x] Retirer l'interdiction technologique absolue du contexte OpenSpec,
  et préserver les règles de produit, la sécurité, la migration et
  les contraintes de checklist.
- [x] Étendre les tests : cas de réussite TS-024 et chemins interdits ;
  contrôle de la provenance du script vérificateur.
- [x] Documenter l'incident, la preuve du checkpoint, la limite du
  travail perdu et les paramètres de reprise sans retry automatique.
- [ ] Valider le `check` GitHub sur le SHA exact de la PR avant fusion.
- [ ] Vérifier CI et Pages de `main` après fusion.
- [ ] Vérifier la remise à niveau non destructive de la branche de plan
  et son état distant de checkpoint avant la reprise manuelle.

## Invariants de sécurité

Aucun code produit ni aucun token/secret ne sont édités dans cette PR.
Aucune exécution facturée d'agent n'est autorisée.
Le checkout d'une branche d'agent et le contrôle de scope ne permettent
pas de contourner le ruleset `Protect Main`.
Les modifications historiques de l'implémentation perdue ne sont pas
récupérables depuis le commit de plan : le prochain `apply` les recréera.

Voir [incident et procédure de reprise](../validation-and-recovery.md).
