# ASF V3 : branche de consolidation des vraies interfaces

**Statut : code de qualification intégré, non exploité par GitHub Actions.** Tâche : [ASF-V3-005](tasks/ASF-V3-005.md).

## Contexte

La V3 comporte quatre contrats préparés en brouillon : [#66](https://github.com/cedricmenec/threadstep/pull/66) (architecture), [#69](https://github.com/cedricmenec/threadstep/pull/69) (noyau pur), [#70](https://github.com/cedricmenec/threadstep/pull/70) (preuve GitHub et port CAS), [#71](https://github.com/cedricmenec/threadstep/pull/71) (lecture figée et pont de claim). Les tests indépendants de chaque PR ne prouvent pas l'intégration des **véritables fonctions**.

La branche de cette PR est donc volontairement issue de #71, complétée par des copies identiques des fichiers de code/tests encore non fusionnés de #69 et #70. Les copies servent uniquement à la qualification intégrée et imposent une revue/rebase soignée avant fusion. Rien n'a été déployé.

## Interface concrète

`createIntegratedV3Ports({ githubReadClient, gitPort, repository })` fournit les cinq ports attendus par `attemptV3ChildClaim` et `attemptV3ControllerAttach` :

| Interface bridge | Implémentation réelle employée | Sens de la preuve |
|---|---|---|
| `loadSnapshot` | `createV3WaveReadPort` + `loadV3TrustedSnapshot` | Lire manifeste et journal au même HEAD, les relire/rejouer |
| `verifyRun` | `observeV3RunProvenance` | Observer sur GitHub le run owner d'origine et le run enfant/contrôleur |
| `transition` | `advanceV3` | Réserver/claimer/attacher via un journal v2 immuable |
| `replayJournal` | `reconstructV3Journal` | Refuser toute divergence de journal et toute révision falsifiée |
| `commitJournal` | `commitV3JournalCAS` | Exiger HEAD attendu, validation candidate, parent exact, `force:false`, read-back |

Les **validateurs ne sont pas injectables** par le consommateur du port, contrairement aux PRs de prototypes. Le constructeur utilise directement `assertV3Manifest` et `reconstructV3Journal`. Pour écrire, il relit le HEAD de vague, refuse un SHA divergent, valide le nouveau journal par rejeu réel, et exige que l'historique d'événements de l'ancien journal soit un préfixe strict du nouveau.

`githubReadClient` s'appuie sur `scripts/asf/github/client.mjs` qui sait limiter et normaliser les erreurs de transport. Dans cette PR, le port Git `gitPort` est encore **simulé** et aucune API GitHub n'est contactée pendant les tests Node.

## Test end-to-end simulé, mais utilisant les vraies fonctions V3

1. Créer un **vrai** manifeste avec `createV3Manifest`.
2. Écrire les événements `RESERVE → DISPATCH_INTENT → ACK_CHILD` avec `advanceV3`.
3. Exposer ces JSON à la fonction réelle de lecture d'une branche et de fichiers REST GitHub via un `createGithubClient` mocké.
4. Fournir les vraies métadonnées attendues du run propriétaire et de l'exécuteur, ou des versions malformées, à la fonction réelle de provenance.
5. Utiliser `attemptV3ChildClaim` et la vraie fonction de transition V3 pour créer `CLAIM_CHILD`.
6. Persister dans le vrai module `commitV3JournalCAS` contre un Git port mémoire qui simule refs, arbres, commits et `updateRef(force:false)`.
7. Répéter simultanément deux demandes concurrentes. Au plus une est autorisée, et aucune ne décale `reserved`.
8. Après `PR_PUBLISHED → DELIVERED → CHECKPOINT` générés par le vrai noyau, vérifier qu'un nouveau run contrôleur `repository_dispatch` peut s'attacher une fois, sans nouvelle autorisation du propriétaire, et ne modifie ni `reserved` ni `delivered`.

Cela démontre la cohérence du **code réel de contrôle métier**. Cela ne démontre pas que les permissions App, les APIs et la protection de branches sont correctes sur GitHub distant.

## Conditions non encore résolues avant une activation

- **Permissions GitHub App** : aucun droit `Actions: write` ou `Contents: write` ajouté. Les modifications de workflows et d'App doivent être proposées dans une PR sensible autorisée séparément.
- **Origine du manifeste et chaîne initiale** : la version est vérifiée structurellement, mais la création de sa branche par l'owner et l'exclusivité des writers doivent être attestées par une politique d'initialisation/protection qui n'existe pas encore en V3.
- **Acteur du bot** : le vérificateur attend `threadstep-software-factory[bot]`. Une qualification GitHub réelle **non payante** devra confirmer l'acteur qui lance `repository_dispatch` / `workflow_dispatch`.
- **Verrou global de modèles** : V1 possède un mutex `threadstep-paid-development-v1`, mais les nouveaux runs V3 doivent le respecter ; l'intégration actuelle n'y accède pas.
- **Contrat de dépenses** : un checkpoint `CLAIM_CHILD` est une donnée, et non une capacité d'appeler OpenRouter. Le futur job enfant devra faire ce preflight avant sa première consommation payante.
- **Gestion du timeout et des réponses ambiguës** : aucune répétition automatique du POST de dispatch ou de l'écriture Git. Toute preuve absente entraîne `STOP_UNCERTAIN` ou un diagnostic bloquant.
- **Durée/quotas** : dix réservations au maximum, zéro retry payant, un développement à la fois. Pas de limite USD garantie.

## Qualification CI et GitHub réel sans dépense

CI : `npm run check`, Actionlint, OpenSpec, avec `check` indépendant sur HEAD de la PR. Les tests synthétiques n'ont ni réseau externe, ni accès aux secrets, ni workflow d'orchestration.

Essai GitHub suggéré : créer une branche sandbox **distincte de `asf/waves/*`**, fabriquer des commits **sans fichiers de workflow ni secrets**, mettre à jour le ref avec `force:false` et un `expected_sha`, puis tenter une écriture au lease périmé. Documenter exactement la preuve du conflit observé et vérifier que `main` n'a pas bougé. La branche sandbox n'autorise aucune tâche et **n'est jamais utilisée par le dispatcher**. Ce test ne valide pas encore le runtime payé ni le claim de production.

## Stratégie de fusion

1. Examiner #66 (conception), puis #69, #70, #71 en conservant une revue humaine séparée pour chacune.
2. Avant la fusion de la présente PR, recalculer sa base à partir de `main` **après** ces revues, sans écraser ni détourner les PR existantes. Retirer de la diff les copies sources désormais déjà intégrées.
3. Vérifier CI indépendante au **SHA rebasé exact**, revue humaine et décision explicite de fusion.
4. Planifier ensuite le lot sécurité GitHub runtime et workflow, avec protection du coût avant toute exécution OpenRouter.

**Cette PR ne fusionne ni n'approuve les autres PR.**


## Compte rendu d'essai Git réel non payant (16 octobre 2026 UTC)

**Branche isolée :** [test/asf-v3-005-cas-38976058955](https://github.com/cedricmenec/threadstep/tree/test/asf-v3-005-cas-38976058955), créée depuis le main initial `646da5ba6b494948aa7d7f7647ef485066900cd2`. Aucun fichier de workflow, aucun journal opérationnel `asf/waves/*`, aucun secret, aucune PR merge, aucun dispatch et aucun appel OpenRouter.

**Protocole :**
1. Lire le commit de base et son tree `e517840e93bdb222e8afeefbc671d9c84e25697f`.
2. Créer deux arbres Git portant des variantes indépendantes d'un unique fichier inerte `sandbox/asf-v3-cas-test.txt`.
3. Créer deux commits frères à parent commun `646da5ba6b494948aa7d7f7647ef485066900cd2` :
   - A `7c4a37d7273acef0c11c7aaa40bcac3c7942537b`
   - B `a026a908438b7a8bd5f832a47804b41eaac5dff4`
4. Avancer le ref sandbox vers A avec `update_ref(force=false, expected_sha=base)`. GitHub a confirmé `success=true`.
5. Tenter ensuite de mettre le même ref sur B avec **le même ancien expected_sha**. La requête a échoué ; l'outil a renvoyé une erreur GraphQL **générique** (`GithubGraphQLAPIError`), sans code fiable permettant d'attribuer formellement le refus à une violation de lease.
6. Relire la branche : HEAD confirmé `7c4a37d7273acef0c11c7aaa40bcac3c7942537b` (A), **pas** B.

**Conclusion limitée et vérifiable :** sur cette séquence réelle, une seule écriture a fait avancer la branche et la tentative périmée n'a pas modifié le HEAD. L'expérience utilise les outils GitHub de connexion et **non** le `gitPort` intégré au code ; ce n'est donc **ni un test E2E de l'adaptateur V3 sur GitHub réel, ni un test de concurrence simultanée**, ni une preuve de provenance/claim payé. La branche sandbox est laissée visible pour audit et peut être supprimée manuellement après revue.

**CI de la PR avant insertion de ce compte rendu :** [run 38976058955](https://github.com/cedricmenec/threadstep/actions/runs/38976058955) réussi sur `c5f684749a2affd01001b5db3cb7da841c1cabd2`, 338 tests Node réussis sur 338. Un changement documentaire ultérieur doit être revérifié sur son nouveau SHA final.
