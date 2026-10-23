# ASF V3 | C4/G2 : contrat de raccordement owner et preuves de qualification

**Date : 23 octobre 2026. Statut : design préparatoire non autorisant.** Cette page ne constitue pas une approbation d'activer ASF V3. La source de pilotage demeure [Plan en cours ASF V3](https://app.notion.com/p/3fc12ac9163680adb3e3e3f63d827f69). Travail associé : [ASF-V3-033](tasks/ASF-V3-033.md).

## 1. Frontières et source de confiance

| Frontière | Autorité exigée | Comportement de refus |
| --- | --- | --- |
| Owner -> contrôleur | `workflow_dispatch` de `backlog-orchestrator-v3.yml` sur `main`, acteur owner, run attempt 1, six inputs exacts et observation indépendante du run ID | Arrêt sans registre ni dispatch si SHA, actor, inputs ou run API divergent |
| Contrôleur -> ref global | GitHub App Controller V3 `5361227`, jeton minimal limité au dépôt cible, **CAS unique** non forcé | Aucun retry d'écriture après réponse ambiguë, readback et quarantaine |
| Contrôleur -> ref vague | Deux rulesets séparés `refs/heads/asf/waves/*` : writer `creation/update` bypass seul Controller ; immutabilité `deletion/non_fast_forward` zéro bypass | Aucune écriture ACK/CLAIM avant qualification G1 et des droits App réels |
| Enfant -> OpenRouter | App exécuteur V1 `5321746` incapable de modifier les refs de contrôle ; preuve ACK et CLAIM_CHILD durable sur la vague, quota disponible, mutex partagé **au niveau job** | Zéro démarrage payant en cas de doute, d'annulation `pending`, de perte de réponse ou de rerun |
| Preuve livraison -> état terminal | Observations indépendantes PR, merge, CI SHA exact, `main`, Pages et ref terminal ; writer contrôleur unique | Ne jamais déduire RELEASE d'un statut fourni par l'enfant seul |

Le `GITHUB_TOKEN` du runner owner en lecture seule ne devient jamais implicitement un jeton App en écriture. Les secrets de l'App contrôleur ne peuvent être exposés à un job appelant un modèle, à une branche de feature, à un fork ni à une PR non fiable.

## 2. Chaîne prévue

1. **Owner attesté.** Exécuter sur `main` protégé, vérifier indépendamment l'identité du workflow GitHub (ID run et SHA), l'unique tentative et les six inputs : `wave_id`, `model`, `max_task_starts`, `auto_merge`, `backlog_commit`, `candidate_set_sha256`. Reconstruire les candidats depuis la révision fixée, contrôler l'allowlist et recalculer le hash.
2. **Contrôle de protection.** Relire les règles de `main`, du registre global et des branches de vague. Vérifier les deux identités App et les permissions des tokens effectifs dans un essai isolé. Une politique structurelle correcte n'est pas une preuve de permission.
3. **Bootstrap unique.** Cas `404` = observation d'absence uniquement, non autorisation. Après approbation ciblée, enregistrer une intention de genèse durable et effectuer l'unique création. Si réponse perdue, conflit, historique déjà présent ou identité douteuse : readback, arrêt et rapprochement sans deuxième création aveugle.
4. **Admission CAS.** Le writer contrôleur calcule le nouvel état et réalise un seul chemin d'écriture Git non forcé. Lier la vague, le run, les limites et les SHA. En cas de concurrent gagnant, ne pas lancer d'enfant ni de modèle pour la vague perdante.
5. **Journal de vague.** Contrôleur crée/actualise seulement le journal protégé. L'enfant fournit l'accusé ACK et la preuve GitHub du run ; le contrôleur réconcilie le parent et applique CLAIM_CHILD CAS. Aucun processus à privilège moindre n'écrit dans le registre global.
6. **Dépenses.** Avant le job rémunéré : ré-observer claim, quotas 1..10, replay, app scopes, droit de démarrage et mutex `threadstep-paid-development-v1` avec `cancel-in-progress:false`. Les jobs en attente peuvent être annulés par GitHub : ne jamais les réessayer automatiquement.
7. **Fin de vague.** Distinguer `DELIVERED` d'une simple PR ouverte. RELEASE doit reposer sur GitHub comme autorité indépendante ; sinon l'état demeure bloqué/quarantaine. Écriture terminale par le même writer CAS protégé.

## 3. Travaux découpés et stratégie de PR

| Lot | Livrable attendu | Dépendances | Critères |
| --- | --- | --- | --- |
| C4a | Tests de provenance owner et six inputs contre formes adversariales | #169 | Validation en lecture seule, refus du run absent, différent ou répété |
| C4b | Ports simulés de genèse / CAS et journal d'intention one-shot | C4a | Échec fermé sur `404` ambigu, `409` / `422`, perte de réponse, ref préexistant |
| C4c | Préflight transversal de sécurité et capacités sans activation | C4a/b + G1 administratif | Aucun jeton write exposé à un enfant, permission distincte démontrée |
| C4d | Harness G3 en dépôt isolé et rapport de preuves | C4c + accords ciblés | Deux owners concurrents, refus V1, QUARANTINE, RELEASE, aucun LLM |
| C4e | Convergence finale et stratégie de fusion canonique unique | C4a-d | `main` actuel intégré, CI SHA exact, pas de double fusion de stack |
| G4 | Pilote réel quota 1 | G1-G3 approuvés | Nouveau consentement explicite préalable aux coûts et à l'activation |

Les modules qui « constatent » des règles ou des intentions ne doivent jamais renvoyer une permission `canSpend:true` : seul un futur chemin privilégié, séparément audité et autorisé, peut franchir cette frontière.

## 4. Scénarios négatifs incontournables

| Essai | Condition de succès |
| --- | --- |
| Run owner usurpé, inputs en trop/moins, SHA changé, `run_attempt > 1` | Arrêt avant création et dispatch |
| App V1 tente une création / mutation des refs de vague ou globale | GitHub refuse réellement |
| App contrôleur tente suppression ou force-push | GitHub refuse réellement |
| Deux demandes d'admission ou ACK/CLAIM simultanées | Au plus un commit CAS accepté ; aucune seconde dépense |
| Timeout / réponse perdue pendant genèse ou terminal | Readback et investigation, aucun retry destructif/payant |
| Pending GitHub annulé avant exécution ou enfant relancé | Quota et intention réconciliés, pas de paiement implicite |
| CI verte sur ancien SHA, PR non fusionnée, Pages absentes | RELEASE refusé |
| Périmètre inter-dépôts / installation App mal configurée | Refus fermé, aucune propagation de droits |

## 5. État constaté le 23 octobre

- C1/C2/C3 : préparés et prouvés sur les PR #126 / #168 / #169 ; pas encore livrés sur `main`.
- `main` courant au contrôle : `b0ad3f9292acffff3f2b5cbe93c84f1fd95da30a`. La CI #39579528036 de #169 concerne `a9be5cb9969055fe572380ec8f14c41e26c70b19`, **pas** cette nouvelle base.
- Trois rulesets actifs seulement : #25163425 (main), #25316890 (writer global), #25316926 (immutabilité globale). Les **deux** rulesets wave manquent ; registre global absent (HTTP 404).
- [Mutex M01-M07](https://github.com/cedricmenec/asf-v3-mutex-lab/blob/main/evidence/ASF-V3-M01-M07-2026-10-18.md) : essais isolés documentés, non probants sur les tokens réels.
- Prochaine intervention administrative limitée à la création de deux règles [GitHub Rulesets](https://github.com/cedricmenec/threadstep/settings/rules). Aucun secret, workflow payant ni protection existante modifiés ici.

## 6. Critères d'autorisation avant une fusion sensible

**NO-GO jusqu'à preuves cumulatives** : G1 rulesets, essais négatifs sur vrais jetons des deux Apps en bac à sable, simulations C4/G3, validation CI indépendante sur SHA actualisé, approbation explicite des modifications privilégiées et procédure de rollback/quarantaine. Une autorisation de produire des PR ordinaires n'est pas une autorisation de bootstrap live ou de dépense.