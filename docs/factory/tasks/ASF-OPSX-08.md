# ASF-OPSX-08 | Autocorrection bornée des tests pendant apply

**Automation: manual**

## Incident et valeur

[TS-049 run #39483274048](https://github.com/cedricmenec/threadstep/actions/runs/39483274048) : plan OpenSpec checkpointé, puis tests simulés défectueux (identifiants incohérents, dépendances `businessAllowed` et `selectReadingAnchor` absentes), plusieurs essais de correction, mais pas de `npm run check` vert avant arrêt du runner (exit 143). L'origine exacte de cet arrêt n'est pas démontrée.

La consigne `apply` « If requirements are ambiguous or tests fail, stop and report the blocker » est inadaptée aux échecs de tests ordinaires.

## Périmètre

- Demander à OpenCode d'investiguer et de corriger erreurs de code **ou de banc de test** pendant `apply`, puis de relancer les tests ciblés et `npm run check` dans **la même invocation payante**, dans la limite du budget d'exécution.
- En cas d'ambiguïté réelle, de besoin de modifier des chemins interdits ou de budget insuffisant pour implémenter et vérifier, arrêter avec diagnostic.
- Conserver les cases non validées, la validation stricte OpenSpec, le checkpoint uniquement après `npm run check` vert, les restrictions de fichiers et les protections de fusion.
- Aucun retry automatique `opencode run`/workflow ni nouveau paiement après échec. Reprise uniquement avec autorisation explicite.

## Vérification et limites

- Tests déterministes des invariants du prompt ; `npm run check`, Actionlint, CI `check` indépendante.
- Aucun test payant réel, aucun secret, modèle, timeout, workflow de fusion, permission ou code produit modifié.
- La cause du shutdown `143` n'est pas imputée au prompt sans preuve ; cette PR améliore le comportement avant cette interruption, pas la stabilité du runner.

## Publication

PR ASF distincte soumise aux règles Protect Main. Aucun lancement OpenRouter.
