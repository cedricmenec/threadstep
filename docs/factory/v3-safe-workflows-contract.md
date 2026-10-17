# ASF-V3-013 — Workflows V3 en mode non payant, fail-closed

**Proposition de workflows pour revue uniquement. Non déployés sur main.**
Autorisation de la racine réelle : [issue #86](https://github.com/cedricmenec/threadstep/issues/86).
Ceci documente le rôle de chaque trigger, job et step, y compris la maintenance.

## Workflow 1 : backlog-orchestrator-v3.yml

Déclenchement : manuel workflow_dispatch, acteur propriétaire, main, première tentative. Le futur utilisateur doit saisir explicitement wave_id, model, max_task_starts (choix 1 à 10), auto_merge, backlog_commit et candidate_set_sha256.

Les six inputs correspondent au contrôle du mandat proposé dans #79. Un input, même provenant du workflow, ne prouve pas par lui-même l'autorisation de créer une vague.

Permissions : contents:read et actions:read uniquement. Aucune permission write, secret, installation App ou dépense.

**Job owner-preflight** :
1. Check out V3 source at dispatched commit : checkout du code déclenché, persist-credentials:false.
2. Set up Node.js runtime : Node 22, aucun agent payant.
3. Deny until owner-pinned trust root and global registry are approved : CLI workflow-runtime-preflight.mjs controller, exit 1 systématique tant que la racine et le writer ne sont pas approuvés.

La condition du job bloque les acteurs non propriétaires, les branches autres que main et les nouvelles tentatives. Ce filtrage reste insuffisant sans issuer fiable.

## Workflow 2 : agent-openspec-v3.yml

Déclenchement : workflow_dispatch de l'identité GitHub App prévue (bot), main, première tentative, avec wave_id, task_id et reservation_sha. Ces trois champs sont des pointeurs non fiables : ils ne donnent aucune permission de paiement et ne remplacent pas la preuve CAS.

Permissions : contents:read, actions:read.

**Job child-preflight** :
1. Check out V3 source without retaining credentials : checkout source V3, sans persistance token.
2. Set up Node.js runtime : Node 22.
3. Reject paid execution until trusted global and wave claims exist : CLI workflow-runtime-preflight.mjs child, refus systématique.

Aucun job de modèle payant, aucun appel OpenRouter, aucun GitHub App token d'écriture ni workflow dispatch secondaire. Il est impossible de fusionner, payer ou créer une vague par ce YAML dans son état proposé.

### Séparation de l'ancien workflow V1

Le workflow .github/workflows/agent-openspec.yml V1 contient une restriction actor owner et **ne doit pas être réutilisé** pour un enfant bot V3. Les références V3 dans lifecycle.mjs, provenance.mjs et transaction-bridge.mjs, ainsi que les fixtures de test, pointent uniquement vers agent-openspec-v3.yml. Le workflow V1 n'a pas été modifié.

## Garde de sécurité du runtime

Le nouveau workflow-runtime-preflight.mjs vérifie l'identité et le contexte du run. Même si le contexte correspond, il lit le verrou production-trust-root.mjs, où PINNED_PRODUCTION_ROOT = null. Le verdict est disabled, sans issuer ni paiement. Si une future PR configure la racine, le code restera bloquant tant que le CAS du global ref, le CLAIM_CHILD du journal et les preuves de livraison ne sont pas réellement câblés.

Le groupe d'exclusivité des jobs payants V1, threadstep-paid-development-v1, n'est pas consommé dans ces deux YAML **car ils n'exécutent rien de payant**. Un futur job payant V3 devra le reprendre au niveau job avec cancel-in-progress:false, sans s'en servir comme file durable. Il devra également réaliser l'admission globale, le claim CAS et l'interdiction totale du retry payé.

## Blocages restant à lever

1. Décider dans l'issue #86 de l'issuer de confiance, de son détenteur de clé privée isolée, du pinning de la clé publique et d'un checkpoint externe monotone.
2. Initialiser le ref global à partir d'une genèse approuvée et protéger ses mutations.
3. Compléter RELEASE/QUARANTINE avec preuve indépendante, témoin Git signé et writer CAS. La PR #85 ne prouve que la cohérence d'un candidat, sans autorisation.
4. Qualifier des runs GitHub App réels, sans paiement, puis implémenter le dispatch, l'ACK et le claim vérifiés.
5. Faire approuver explicitement l'ajout du job payant et ses droits puis un premier pilote OpenRouter de 1 tâche.

## Maintenance

Aucune modification future ne doit contourner les conditions actor, main et attempt 1, introduire un secret dans ces jobs de diagnostic, changer une branche de vagues depuis un CLI non approuvé, ou remplacer un exit 1 par un succès avant la preuve GitHub E2E. CI actionlint plus tests Node à chaque révision ; les autorisations owner sont séparées de la réussite des tests.

**CI verte ne signifie pas autorisation de production. Aucun workflow n'est fusionné ici.**
