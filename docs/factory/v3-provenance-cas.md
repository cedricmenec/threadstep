# ASF V3 : vérification de provenance et journal durable à écriture conditionnelle

**Statut : adaptateurs isolés et tests simulés uniquement, non intégrés aux workflows GitHub Actions.** Lié à [ASF-V3-003](tasks/ASF-V3-003.md). Base de conception : [PR #66](https://github.com/cedricmenec/threadstep/pull/66) et noyau V3 en [PR #69](https://github.com/cedricmenec/threadstep/pull/69). Ces PR restent en revue ; aucune activation V3 n'est annoncée.

## 1. Objectif fonctionnel

Une vague peut nécessiter plusieurs runs GitHub Actions pour atteindre dix tâches. Avant tout nouveau travail payant, il faut prouver **quel run** a lancé la vague, **quel run enfant** a effectivement été déclenché, et **quel checkpoint journal** contient cette autorisation. Un agent ne doit jamais créer lui-même la preuve qui lui donne le droit d'être payé.

La V1 utilise `workflow_call` et un identifiant de parent commun. Cette hypothèse ne tient plus lorsque le workflow enfant est déclenché par API, avec son propre run ID et un acteur GitHub App. Le contrat doit donc se fonder sur **des consultations indépendantes de l'API GitHub**, associées à un journal persistant dont les modifications concurrentes sont contrôlées.

## 2. Module lecture seule : provenance.mjs

`observeV3RunProvenance(client, { authorization, reservation, context, kind })` fonctionne avec le [client GitHub V1 existant](../../scripts/asf/github/client.mjs) et son transport lecture seule.

La fonction :
1. Valide localement que le contexte du run correspond au dépôt, à `main`, au chemin du workflow V3 attendu, à son événement `workflow_dispatch` ou `repository_dispatch`, à la tentative 1 et à l'acteur GitHub App prévu.
2. Demande à GitHub le **run propriétaire originel par ID exact**, et contrôle acteur, chemin `backlog-orchestrator-v3.yml`, `workflow_dispatch`, `head_sha`, `run_attempt=1` et branche `main`. Un run parent terminé en échec ne peut pas servir de preuve d'origine.
3. Demande à GitHub le **run enfant ou contrôleur de continuation par ID exact** et vérifie événement, acteur, workflow, `head_sha`, tentative et état compatible avec un run encore actif.
4. Retourne seulement `verified_observation`, `rejected` ou `uncertain` avec un code stable. Une preuve incomplète, une API indisponible ou des métadonnées contradictoires n'autorisent aucune continuation ni paiement.

Les réponses API et les faits observés sont injectés en test. **Les paramètres `authorization` et `reservation` ne doivent jamais venir directement des inputs du run enfant** : il faudra les lire du manifeste/journal versionnés de la branche opérationnelle, validés par un mécanisme CAS de confiance. Le hash du résumé d'observation est utile pour le diagnostic, **pas une signature de sécurité**.

### Hypothèses à contrôler avant raccordement

- Le nom attendu du bot de GitHub App est `threadstep-software-factory[bot]`. Si GitHub utilise un autre acteur de confiance pour le dispatch réel, adapter la politique par revue sécurité, **jamais** en acceptant un acteur arbitraire.
- Les chemins attendus `backlog-orchestrator-v3.yml` et `agent-openspec.yml` sont des contrats projetés ; le premier n'est **pas** présent sur main.
- Les runs de continuation utilisent `repository_dispatch` **envisagé**, non autorisé ici. Tout autre mécanisme nécessitera une ADR et des tests spécifiques.
- Pour le child, le SHA du code `main` qui exécute le workflow peut avoir avancé après la livraison précédente ; il est distinct du `backlogCommit` original, qui fige les tâches. Le `headSha` observé doit correspondre au SHA enregistré dans le journal via un adaptateur contrôleur fiable.
- Les permissions `Actions: read` suffisent à la lecture des runs, sous réserve des droits GitHub effectifs. Les permissions de dispatch et de publication **ne sont pas demandées** ici.
- Le claim CAS de réservation, l'anti-replay complet, la validité des inputs `workflow_dispatch` et le verrou global entre vagues sont **non implémentés**. Ne jamais interpréter la valeur `ok: true` de cette observation comme « paiement autorisé ».

## 3. Module écriture conditionnelle : git-cas.mjs

`commitV3JournalCAS(port, { waveId, expectedHeadSha, journal, validateJournal })` utilise un **port Git injectable**, avec les méthodes `getRef`, `getCommit`, `createTree`, `createCommit`, `updateRef`.

Le chemin de branche est construit par le code, sans entrée arbitraire : `refs/heads/asf/waves/<waveId>`. Le seul fichier modifié dans l'arbre Git est `journal.json` ; l'ancien manifeste n'est jamais réécrit par ce port.

Une écriture suit strictement ces opérations :
1. Refuser un `waveId` et un SHA d'attente malformés ; exiger un `validateJournal` fiable qui rejoue tous les événements par rapport au manifeste V3 approuvé, conformément au noyau [ASF-V3-002](https://github.com/cedricmenec/threadstep/pull/69).
2. Refuser un journal d'une autre version, les données ressemblant à des secrets et les contenus dépassant la taille maximale définie.
3. Lire la branche opérationnelle et exiger que son HEAD soit **exactement** `expectedHeadSha`.
4. Lire le commit parent attendu et son `treeSha`; construire un arbre dérivé qui remplace **uniquement** `journal.json`.
5. Créer un commit à **un seul parent** : le HEAD attendu.
6. Effectuer `updateRef(force:false)` : la seule écriture susceptible de faire avancer la branche de vague. Deux commits construits sur le même ancien parent sont des **frères** ; un seul peut faire avancer le ref par fast-forward.
7. Relire le ref et le commit nouvellement visible et vérifier ref, parent unique et arbre ; retourner `persisted` uniquement si tout concorde.

### Protocole anti-concurrence

```text
Lecteur A -> head H -> commit A(parent H) --                                         updateRef(force:false) -> OK
Lecteur B -> head H -> commit B(parent H) --/
                                         updateRef(force:false) -> 409/422 (pas de retry)
```

Si une réponse API est perdue **après la mise à jour de ref**, le résultat reste `uncertain`, sans répétition. Une inspection humaine du HEAD permettra de réconcilier le journal avant toute autre action.

Le contrat de transport Git API concret doit garantir que `getRef`, `getCommit`, `createTree`, `createCommit` et `updateRef` parlent bien au dépôt approuvé, avec un token GitHub App limité, jamais à un endpoint fourni par une tâche ou un agent. Aucun port de production n'est fourni dans cette PR.

## 4. Limites de preuve et d'atomicité

- Le CAS Git peut refuser une écriture concurrente du journal **si** le provider GitHub respecte la condition fast-forward de `force:false` et que le commit n'a qu'un parent connu. Cette propriété est testée contre un simulateur ; elle n'est **pas encore prouvée E2E** avec GitHub API réelle.
- Une requête HTTP `workflow_dispatch` et la mise à jour d'une branche Git ne forment pas une transaction unique. **Le run enfant doit attendre un ACK du run ID durable puis effectuer un claim atomique** avant OpenRouter. Ces étapes restent à intégrer et à éprouver.
- Le workflow lui-même doit authentifier le run, consulter les permissions réellement accordées à la GitHub App, protéger la branche opérationnelle contre les écritures externes et lier `reservationId`, `taskId`, `model`, `manifestHash`, `runId` et `runAttempt`. Ces protections ne sont pas implémentées par une API de métadonnées.
- Un échec CI ou Pages prouvé est différent d'une preuve indisponible. Les deux interdisent de démarrer la tâche suivante ; l'état terminal et le diagnostic sont déterminés par le contrôleur supérieur.
- Aucune limite de USD n'est garantie par ce mécanisme de journal.

## 5. Tests et validation

Les tests `tests/asf-v3-provenance-cas.test.mjs` simulent des appels à GitHub en lecture, toutes les combinaisons principales d'identité, les erreurs réseau, la concurrence de writers à base commune, le `force:false`, le ref qui avance entre la lecture et l'écriture, et une réponse perdue après mise à jour. Ils n'engagent **aucun token GitHub ni aucun coût OpenRouter**.

Contrôles attendus avant décision de fusion : `npm run check`, lint workflows existants par CI indépendante, absence de nouvelles permissions, revue humaine du rôle de l'App, concordance de la documentation des risques et CI sur le SHA final.

## 6. Prochaine intégration sensible

Une PR dédiée pourra raccorder l'adaptateur GitHub REST/Git Data réel à `reconstructV3Journal`, aux décisions du scheduler et à l'authentification pré-paiement. Une autre PR devra traiter la modification des workflows Actions, le dispatcher et les permissions `Actions: write` de manière explicitement approuvée.

La livraison de ces deux modules **ne permet pas à elle seule** de lancer une vague de dix tâches, même après une éventuelle fusion.
