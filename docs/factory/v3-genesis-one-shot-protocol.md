# ASF-V3-020 — Protocole de genèse one-shot, modèle pur

**Statut : implémentation non payante en PR brouillon, sans appel GitHub ni secret.** Base de revue : V3-019 (#104) puis #102, #100, #99, #97, #96, #87.

Le problème traité : lorsqu'un client émet une demande de création de branche Git et que la réponse est perdue, répéter la création peut masquer une collision, réutiliser un mandat ou écraser un état plus récent. Aucun retry automatique ne doit avoir lieu.

## Protocole exact modélisé

`scripts/asf/v3/genesis-one-shot-protocol.mjs` est **une fonction de transition pure**. Elle n'a ni client HTTP, ni import GitHub, ni writer, ni token et n'est pas utilisée par le workflow privilégié.

1. `PLAN` : attacher run owner, SHA du commit d'origine `main`, ref exact `refs/heads/asf/control/active-wave-v3`, SHA-256 du registre canonique vide. Aucune preuve d'authentification à elle seule.
2. `TREE_STAGED` puis `COMMIT_STAGED` : enregistrer les SHA observés, la concordance du tree et l'unique parent égale au SHA d'origine. Cela ne certifie pas les réponses GitHub ; le futur runner doit les lire indépendamment.
3. `BEGIN_CREATE_ATTEMPT` : **une seule transition autorisée**, `createAttemptCount=1`. **Point de coupure de sécurité** : le futur writer devra PERSISTER DURABLEMENT CET ÉVÉNEMENT AVANT l'unique requête réseau de création.
4. `CREATE_ACK` : enregistrer seulement une réponse conforme au ref/commit attendus, sans déclarer la genèse terminée.
5. `READBACK_MATCH` : représenter l'observation d'une référence Git, d'un commit parent et d'un registre vide correspondant. Le protocole renvoie `VERIFIED_OBSERVED` mais toujours `authorized:false`, `canCreate:false`, `canWrite:false`, `canSpend:false`.
6. `MARK_UNKNOWN` pour timeout, conflit, réponse perdue ou preuve incohérente : **QUARANTINED** définitivement. Jamais un second `BEGIN_CREATE_ATTEMPT` et aucun `CREATE_ACK` tardif pour relancer.
7. `ABORT_BEFORE_CREATE` : STOP possible seulement avant l'enregistrement de l'intention ; un événement postérieur à la tentative doit être traité comme incertain, et non comme une nouvelle tentative.

Chaque transition est versionnée, liée à une révision locale, rejouée depuis tous les événements et rejetée si un compteur, un parent SHA, un événement ou un hash de registre est falsifié. Les événements contenant des secrets sont refusés.

## Limite explicite de sécurité

**Ce modèle ne garantit PAS à lui seul l'exécution exactement une fois dans GitHub**, car un programme en mémoire n'est pas un verrou distribué. Le futur writer devra ajouter :

- Un mandat propriétaire durable, non réutilisable, capturé sur `main` et vérifié contre l'API Actions.
- Un marqueur persistant de tentative **avant** la création GitHub, séparé du ref encore absent ; après perte de réponse, inspection manuelle plutôt qu'un nouveau run.
- Un jeton éphémère de l'App `5361227` strictement limité à `threadstep`, et les deux rulesets exacts prouvés par tests réels avec identité App V1 distincte.
- Une requête de création réellement unique avec refus strict si le ref existe ; aucune suppression, force-push ou overwrite, même dans un état `QUARANTINED`.
- Une relecture REST indépendante du commit, tree, ref, registre au SHA exact. Un échec de readback stoppe et met en quarantaine.

Le modèle sert uniquement à garantir que la politique de transitions ne transforme pas une incertitude en retry ou en paiement. **Le bootstrap opérationnel, la persistance durable d'intention et la validation d'accès App sont encore à implémenter puis auditer séparément.**

Tests négatifs : duplications, perte de réponse, deux résultats contradictoires, parent/tree SHA incorrect, tentative post-quarantaine, mutation de l'historique, corruption des compteurs, injection de secret, révision locale périmée.

Suivi propriétaire : [issue #86](https://github.com/cedricmenec/threadstep/issues/86), [procédure Notion](https://app.notion.com/p/3fc12ac9163681eb8dacca65bdbfc882).