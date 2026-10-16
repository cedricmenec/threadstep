# ASF V3 : pont transactionnel entre les preuves GitHub et le journal

**Conception et code de simulation. Statut : NON OPÉRATIONNEL.**

Référence de tâche : [ASF-V3-004](tasks/ASF-V3-004.md). Dépend des PR [#66](https://github.com/cedricmenec/threadstep/pull/66), [#69](https://github.com/cedricmenec/threadstep/pull/69) et [#70](https://github.com/cedricmenec/threadstep/pull/70), non fusionnées au démarrage de ce lot.

## 1. Contrat métier

Le propriétaire autorise une seule vague bornée entre 1 et 10 démarrages réservés. Chaque exécuteur payant doit prouver, **avant** tout appel modèle, qu'il est le seul run ayant revendiqué la réservation et que le journal opérationnel contient l'ACK de ce run exact. Après une livraison réellement vérifiée et un checkpoint persistant, un autre run contrôleur peut continuer **au titre du même mandat**.

Cette PR n'exécute aucune de ces opérations en production. Elle fournit le montage modulaire et les simulations des barrières nécessaires pour réaliser plus tard ces contrôles.

## 2. Vue logique

```text
      GitHub read-only REST                    Git commit-CAS (non branché)
  ref asf/waves/<waveId> at H                           ^
                  |                                      |
        manifest.json @ H + journal.json @ H             |
                  |                                      |
      verifyManifest + replayJournal (ports sûrs)        |
                  |                                      |
             snapshot figé                               |
                  |                                      |
          vérifier run propriétaire                      |
          et run enfant sur GitHub                       |
                  |                                      |
    comparer ACK, taskId, runId, attempt, SHA            |
                  |                                      |
        transition CLAIM_CHILD ou ATTACH_CONTROLLER      |
                  |                                      |
        replay de journal candidat + CAS (head H) -------+
                  |
        succès CAS confirmé ?  oui -> checkpoint seulement
                             non -> STOP, jamais retry
```

**Précision :** le module du pont n'effectue pas de dispatch, n'a pas de token App, ne démarre pas OpenRouter et n'autorise pas automatiquement une dépense lorsque le checkpoint est committé. Il conserve une frontière explicite entre l'observation, la persistance et l'autorisation future d'un travail payant.

## 3. Lecture d'un snapshot V3 depuis GitHub

`createV3WaveReadPort(client, repository)` prend un client GitHub **lecture seule** (comme le client existant `scripts/asf/github/client.mjs`) et fixe un dépôt. Il construit exclusivement trois types de GET :

| Action | Ressource REST |
| --- | --- |
| Trouver la tête d'une vague | `repos/<repo>/git/ref/heads/asf/waves/<waveId>` |
| Lire le manifeste figé | `repos/<repo>/contents/manifest.json?ref=<headSha>` |
| Lire le journal à la même révision | `repos/<repo>/contents/journal.json?ref=<headSha>` |

Le lecteur vérifie le ref attendu et son type `commit`, la forme du SHA, la taille des fichiers, le type et chemin du `content`, le base64 strict, la cohérence de taille et l'UTF-8. Il refuse toute lecture d'autres fichiers ou branches arbitraires.

`loadV3TrustedSnapshot(port, waveId, validators)` demande :
- `verifyManifest(manifest) === true`, à raccorder impérativement à `assertV3Manifest` de la #69 une fois celle-ci revue et fusionnée ;
- la correspondance `schemaVersion=2`, `waveId`, `journal.manifestHash === SHA256(manifest)` ;
- `replayJournal(manifest,journal)` dont le résultat canonique est identique au journal lu, à raccorder à `reconstructV3Journal` ;
- un refus des valeurs ressemblant à des secrets avant de retourner le résultat.

Une lecture incomplète est `uncertain`, une structure contradictoire est `rejected`. Aucun cas ne déduit « aucune tâche en cours » d'un résultat inconnu.

**Limites :** le SHA épingle les fichiers d'un commit Git, mais cette PR n'établit pas encore que la branche opérationnelle initiale fut créée par le bon acteur et reste hors de portée de tout acteur non autorisé. Une preuve de la chaîne initiale du manifeste (run owner, politique, protections de main) et le contrôle des droits en écriture devront être assurés par une intégration de confiance.

## 4. Claim enfant et continuation

`attemptV3ChildClaim(ports,{waveId,taskId,runtime})` charge le snapshot, vérifie l'état `CHILD_ACKNOWLEDGED`, l'identité exacte du run enregistrée dans `active` et la présence de la fiche dans le manifeste figé.

Le contexte `runtime` doit provenir d'un **adaptateur de confiance du runner GitHub**, en dehors de l'espace OpenCode. Le pont vérifie repo, `main`, chemin attendu, `workflow_dispatch`, acteur App, `runAttempt=1` et SHA 40 caractères ; puis il demande un résultat `verified_observation` au vérificateur indépendant de provenance de la #70. Il compare de nouveau les IDs, sources SHA, événement et workflow. Il ne fait pas confiance à un simple booléen `ok`.

Si la preuve est certaine, il propose l'événement `CLAIM_CHILD` à la fonction de transition V3 de la #69. Il exige une incrémentation exacte de révision, aucune modification du quota, la préservation de l'identité de réservation et un rejeu concluant.

`attemptV3ControllerAttach` suit le même contrat, mais n'accepte que `READY + awaitingController + CHECKPOINT`. Il construit `ATTACH_CONTROLLER` depuis le manifeste et les preuves, sans augmenter `reserved` et sans autoriser un nouvel owner.

Les futurs ports de contrôle `verifyRun` et `commitJournal` doivent être fournis par une implémentation dont le workflow propriétaire contrôle les privilèges et le secret. Un port factice peut uniquement produire un résultat de test.

## 5. Écriture CAS et gestion des incertitudes

Le pont passe `expectedHeadSha` à `commitJournal`, qui devra être l'implémentation contrôlée de la #70 ou équivalent audité. Une réussite ne peut être déclarée que si le port retourne `status=persisted` et un **nouveau HEAD SHA**, après avoir confirmé l'écriture distante conditionnelle. Toute réponse `conflict`, `uncertain` ou exception échoue **sans nouvel appel**.

Le pont contrôle à nouveau `replayJournal` avant la persistance. Un contrôle de révision côté processus ne protège pas de deux runners concurrents ; seul un update-ref atomique non forcé sur Git ou un verrou équivalent peut le faire.

| Incident | Traitement |
| --- | --- |
| Deux jobs chargent le même ACK | Leurs commits CAS frères concourent ; **au plus un gagne** si le port distant est effectivement atomique |
| CI/API GitHub inaccessible | Aucune preuve, aucun checkpoint validé |
| Claim déjà écrit | L'état n'est plus `CHILD_ACKNOWLEDGED` ; second claim refusé |
| Perte de réponse après update-ref | Résultat `uncertain`, **aucun retry** |
| Run de continuation avant livraison | Refus `no_nominal_checkpoint` |
| SHA, run ID ou acteur discordant | Refus avant la moindre écriture |
| Manifest/journal divergence | Refus du snapshot |
| Quota / historique falsifié | Le rejeu intégral doit refuser l'entrée |
| Redémarrage technique | Diagnostic et décision humaine en cas d'incident, jamais relance payante implicite |

## 6. Tests exécutables sans réseau

- `tests/asf-v3-trusted-snapshot.test.mjs` : REST GitHub mocké, documents épinglés, chemins fermés, UTF-8/base64/taille, API indisponible, divergence de journal et secrets.
- `tests/asf-v3-transaction-bridge.test.mjs` : preuve positive/négative, faux bot ou run, attempt 2, ACK absent, deux claims concurrents simulés, cas Git CAS ambigu et refus de continuation sans checkpoint.

Les validateurs, les transitions, la provenance et la persistance du pont sont **injectés dans les tests**, et non les implémentations des PR #69/#70 : elles ne sont pas encore sur `main`. Cela permet une PR indépendante et une CI sans effet de bord, mais **ne démontre pas une intégration réelle**. Une prochaine PR de raccordement devra supprimer les doubles contractuels, utiliser les vraies fonctions V3 et ajouter des tests E2E non payants avec la GitHub App et un vrai ref Git de test.

## 7. Contrôles avant intégration sensible

1. Revue et fusion explicite de #66, #69, #70 et de cette PR selon le protocole d'AGENTS.md. Pas d'auto-merge de ces PR.
2. Construire une factory d'injection de confiance avec les vrais modules V3 et un port GitHub REST authentifié, **sans** laisser un agent fournir les callbacks.
3. Démontrer le CAS sur une branche de test réellement concurrente (pas de branch production) et la provenance de vrais runs non payants.
4. Ajouter les garde-fous `before OpenRouter`, le verrou de développement global, la séparation de tokens et le contrôleur V3 dans une **PR de workflows/permissions séparée autorisée**.
5. Respecter les déploiements progressifs 1/2/3/5/10, aucun run payant sans approbation humaine explicite.
