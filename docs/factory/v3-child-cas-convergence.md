# ASF-V3-031 : réconciliation du CAS enfant

Statut : proposition non privilégiée, PR brouillon fondée sur #128.

## Arbitrage de #111/#113 contre #116/#117

| Invariant | Canonique #111 + #113 | Alternatif #116 + #117 | Décision |
| --- | --- | --- | --- |
| Un seul port ACK/CLAIM | `attemptV3GithubChildWaveCAS` | Deux ports distincts | Garder le canon |
| Run enfant, propriétaire, journal, manifeste | Vérifiés deux fois | Vérifiés deux fois | Garder le canon et resserrer la liaison de preuve |
| ACK persistant avant CLAIM | Contrôlé dans `child-ack-readiness.mjs` | Contrôlé dans #117 | Déjà acquis |
| Un parent unique ACK égal à `reservation_sha` original | Contrôlé deux fois par observateur CLAIM | Contrôle explicite #117 | Déjà acquis ; ajouter des tests adversariaux |
| Deux rulesets de vague distincts | Contrôlés avant et juste avant CAS dans #113 | Non vérifiés par chacun des deux ports | Conserver impérativement #113 |
| CAS parent unique, `force:false`, sans retry | `git-cas.mjs` | Ports injectés | Garder le canon |
| Readback exact | Hash journal/manifeste et SHA | Statut enfant vérifié explicitement | Renforcer les assertions explicites |
| Identifiants des tâches | 024 et 025 utilisés | Collisions 024 et 025 | Fiche supplémentaire 031 ; garder l'historique alternatif |

## Modifications C2

Le validateur canonique vérifie désormais tous les indicateurs de non-autorité, les empreintes SHA-256 et l'identité du dernier événement proposé, liés au run natif. Le readback du CAS confirme explicitement le statut, l'identité du run enfant et le dernier type d'événement.

Tests supplémentaires : ACK à plusieurs parents, parent modifié entre deux observations, ruleset wave supprimé après ACK et bypass wave modifié pendant CLAIM. Aucun second writer n'est introduit.

## Limites et suite

Seuls des ports de lecture et d'écriture injectés sont manipulés. Ces tests ne prouvent ni les permissions GitHub Apps réelles, ni un CAS opérationnel. Les deux rulesets wave manquent toujours. Aucune activation de workflows, bootstrap, fusion sensible, relance ou appel OpenRouter n'est autorisé par ce document.

La CI Node, actionlint et OpenSpec devra être constatée sur le SHA de la PR. En C3, une convergence séparée devra réintégrer les évolutions du main actuel et revalider l'ensemble. Les PR #116/#117 restent accessibles et ne doivent être closes qu'après examen des preuves.

Voir [#126](https://github.com/cedricmenec/threadstep/pull/126) et [issue #86](https://github.com/cedricmenec/threadstep/issues/86).
