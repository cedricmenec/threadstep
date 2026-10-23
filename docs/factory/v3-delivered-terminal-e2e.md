# ASF-V3-021 — Réconciliation RELEASE sur une livraison complète V3

Statut : qualification en **simulation GitHub read-only** ; aucun writer, dispatch réel ou paiement. Base : [PR #105](https://github.com/cedricmenec/threadstep/pull/105) → #104 → #102 → #100 → #99 → #97 → #96 → #87.

## Scénario positif désormais testé de bout en bout

Une vague avec quota **1** et un candidat `TS-012` suit les événements journalisés/rejoués :

`RESERVE → DISPATCH_INTENT → ACK_CHILD → CLAIM_CHILD → PR_PUBLISHED → DELIVERED → CHECKPOINT → COMPLETED_QUOTA`.

Le registre global comporte l'événement `ADMIT` lié au **même** `waveId`, `manifestHash`, `ownerRunId` et `originSha`. La lecture du manifeste/journal se fait au SHA unique de la branche V3 de vague ; le registre est rejoué depuis le SHA de son ref global.

Le rapprochement `observeV3GithubTerminalReadiness` vérifie ensuite **indépendamment** dans un client GitHub de simulation :

1. Les rulesets exacts main/global (App controller `5361227`, deux règles séparées, immutabilité sans bypass).
2. Le numéro de PR, dépôt, cible `main`, HEAD SHA, état fusionné, merge SHA et le lien d'ancêtre entre merge et `main` courant.
3. Un `check` GitHub Actions unique et réussi sur le HEAD de PR **et** sur le SHA de merge.
4. Un unique run Pages `push` sur la branche `main` et le SHA de merge exact, premier attempt, plus son job `deploy` réussi sur ce SHA.
5. La concordance canonique exacte de ces preuves avec l'événement `DELIVERED` du journal Git rejoué.
6. La relecture finale du ref global et du ref de vague pour détecter une modification concurrente.

Le résultat positif n'est toujours que **`terminal_reconciled_not_authorized`**. La proposition `RELEASE` porte la preuve du quota rempli (1 réservé et 1 livré) ; `authorized`, `canRelease`, `canWrite`, `canDispatch`, `canSpend`, `canRetry` restent tous `false`.

## Tests négatifs ajoutés

- Une PR non fusionnée, cible d'un autre dépôt, SHA HEAD incorrect ou merge qui n'est pas ancêtre de `main`.
- Une CI échouée sur le HEAD ou sur le commit fusionné, ou des informations manquantes.
- Un job Pages absent, échoué, sur mauvais SHA ou deux runs concurrents/ambigus.
- Une preuve `DELIVERED` structurellement valide mais mensongère sur son SHA de merge : détection par comparaison indépendante GitHub.
- Une modification du registre global, de la branche de vague ou de `main` pendant l'observation.
- Les échecs des appels API PR/CI/Pages empêchent toute proposition de clôture.

## Bloquants réels

Le test utilise un **readClient simulé** et ne prouve pas que l'App est autorisée à écrire ni que GitHub Pages est réellement déployé. Il ne réalise pas `RELEASE` sur Git : cela requiert encore un **writer CAS terminal** qui relise toutes les preuves au dernier SHA, applique une transition unique et vérifie le ref global après la transaction.

Les tests de permissions effectives, le bootstrap live, le dispatch/ACK/CLAIM_CHILD réel, le mutex paid V1/V3 et l'activation OpenRouter restent à développer/auditer et exigent une autorisation distincte.

Suivi : [issue #86](https://github.com/cedricmenec/threadstep/issues/86).