# ASF-V3-029 : arbitrage de deux implémentations concurrentes ACK/CLAIM

**Statut : proposition de réconciliation, non autorisante, sans merge ni production.** Les PR existantes sont laissées intactes. Voir [issue #86](https://github.com/cedricmenec/threadstep/issues/86).

## Choix de base proposé

- **Chaîne canonique de sécurité :** #109 → [#111](https://github.com/cedricmenec/threadstep/pull/111) → [#112](https://github.com/cedricmenec/threadstep/pull/112) → [#113](https://github.com/cedricmenec/threadstep/pull/113) → [#120](https://github.com/cedricmenec/threadstep/pull/120) → [#122](https://github.com/cedricmenec/threadstep/pull/122). Elle contient le CAS intégré ACK/CLAIM, le mutex V1/V3, et la vérification des **deux rulesets de branches `asf/waves/*` avant et juste avant l'écriture**. #120/#122 qualifient en laboratoire le comportement du mutex, pas la production.
- **Chaîne alternative :** #109 → [#116](https://github.com/cedricmenec/threadstep/pull/116) → [#117](https://github.com/cedricmenec/threadstep/pull/117). Elle propose les ports ACK et CLAIM séparés, dont le contrôle du **parent unique du commit ACK = SHA de réservation**. Le code reste hors de la chaîne canonique, et ses deux fonctions `attemptV3GithubChildAckCAS`/`attemptV3GithubChildClaimCAS` ne vérifient **pas** indépendamment `observeV3GithubWaveRulesetPolicy` de #113 avant leur écriture. Cette absence constitue un **blocage d'intégration**, et non une vulnérabilité de production active puisque les ports ne sont pas branchés à une App réelle.

## Conflits avant tout portage

| Sujet | Chaîne canonique | Alternative | Décision de travail |
| --- | --- | --- | --- |
| Tâche `ASF-V3-024.md` | #111, CAS combiné | #116, ACK séparé | Collision de chemin et d'identifiant : ne pas écraser le document existant. |
| Tâche `ASF-V3-025.md` | #112, mutex | #117, CLAIM séparé | Collision de chemin et d'identifiant : réserver de nouveaux IDs pour les évolutions futures, maintenir l'historique des PR. |
| Writer ACK/CLAIM | `github-native-child-wave-cas.mjs`, préflight wave rulesets ajouté en #113 | `child-ack-cas.mjs`, `child-claim-cas.mjs` | Les deux chemins ne doivent jamais devenir deux chemins d'autorité actifs. |
| CLAIM parent-pinné | Déjà contrôlé dans les preuves du préflight commun selon #111 | Contrôle explicite de l'unique parent ACK dans #117 | Comparer les tests et les invariants, transférer seulement ce qui manque. |
| Mutex `threadstep-paid-development-v1` | #112 + tests GitHub isolés | Aucun droit paid accordé | Garder le contrat canonique job-level ; aucun préflight n'occupe le mutex. |

## Règles d'intégration proposées

1. Ne **pas** fusionner ni chaîner #116/#117 telles quelles sur #122. Évaluer leurs apports point par point, sans transporter automatiquement des écrivains parallèles.
2. Toute amélioration utile doit être codée et testée dans une PR distincte, fondée sur la tête canonique, à travers **un seul chemin CAS** protégé par `observeV3GithubWaveRulesetPolicy` au minimum deux fois, dont une immédiatement avant l'écriture, avec refus fermé si les règles de vague manquent.
3. Préserver les invariants de #117 : commit ACK à **parent unique = `reservation_sha` originel**, identité du run GitHub exact, projet/registre ACTIVE, non-retry sur réponse ambiguë et readback au SHA réellement écrit.
4. Ne jamais déduire une permission de merge ou de paiement des succès de simulations. Le writer réellement authentifié par App, les permissions live, les rulesets de branches de vague, le bootstrap et l'environnement propriétaire font encore l'objet d'une autorisation distincte.
5. Après revue, marquer les PR prototypes #116/#117 comme *superseded by canonical integration* via commentaire, **sans fermer ni fusionner automatiquement** et sans perdre leur historique.
6. La CI doit être rejouée au SHA exact de la PR d'intégration et plus tard sur `main` actualisé. `backlog_commit` et `candidate_set_sha256` seront recalculés au `main` approuvé au moment d'un éventuel mandat.

## Code de vérification ajouté

`scripts/asf/v3/pr-stack-reconciliation.mjs` contrôle la topologie et les artefacts attendus des deux stacks, détecte le conflit des tâches et retourne systématiquement `authorized:false`, `canMerge:false`, `canSpend:false`. Il n'est ni un moteur de merge ni une preuve de permissions live. `tests/asf-v3-pr-stack-reconciliation.test.mjs` vérifie notamment que les PR sorties de draft, les changements de base ou les SHA invalides sont refusés.

## Bloqueurs constatés en lecture seule sur GitHub

Au 18 octobre 2026, la liste GitHub REST de `threadstep` comporte 3 rulesets actifs : `main`, le writer global et l'immutabilité globale. **Aucun ruleset de branches de vague** `refs/heads/asf/waves/*` ne figure dans la liste. Les rulesets du ref global `refs/heads/asf/control/active-wave-v3` ont été inspectés par leurs IDs 25316890 (App 5361227 bypass unique `always` pour creation/update) et 25316926 (deletion/non_fast_forward sans bypass). Le ref global n'existe toujours pas (404 observé). Aucun de ces constats n'autorise sa création.
