# ASF-V3-019 — Qualification du bootstrap par le run propriétaire, sans écriture

Statut : **lecture seule, PR brouillon empilée sur #102**, non payant, aucune activation.

## Chaîne de contrôle effectivement raccordée

Le préflight de `.github/workflows/backlog-orchestrator-v3.yml` continue à lire les six paramètres directement dans `GITHUB_EVENT_PATH` et à vérifier le run `workflow_dispatch` sur `main` auprès de l'API GitHub. Il exécute désormais une **étape logique supplémentaire** via `inspectV3OwnerGenesisReadiness` dans `owner-run-capture.mjs` :

1. Vérifier la variable publique d'environnement `ASF_V3_CONTROLLER_APP_ID=5361227`, distincte de l'App V1 `5321746` ; l'environnement GitHub réel doit rester réservé à `main` et à la revue propriétaire.
2. Vérifier l'identité du run GitHub, ses six inputs figés et le hash canonique de la liste de candidats reconstruite depuis les fichiers du backlog.
3. Vérifier les trois rulesets actifs `main` / `creation+update` / `deletion+non_fast_forward` en lisant les détails REST, avec bypass du seul contrôleur `5361227` sur la règle writer et aucun bypass sur l'immutabilité.
4. Relire le SHA du HEAD `main` et la référence globale `refs/heads/asf/control/active-wave-v3`. Un `404` normalized `error.status=404` est **une observation non fiable d'absence**, jamais une autorisation de créer.
5. Si le ref existe, lire `registry.json` **au commit SHA exact**, rejouer l'historique et refuser toute tentative de remise à zéro, y compris s'il ne contient encore que la genèse.
6. Relire `main` et le registre pour détecter une course. Si toutes les données sont cohérentes, retourner `genesis_absent_observed_no_authority` ou `genesis_exists_do_not_recreate`.
7. **Conserver le `Deny` final du workflow sans exception.** Ces statuts portent tous `authorized:false`, `canCreate:false`, `canWrite:false`, `canDispatch:false`, `canSpend:false` et `canRetry:false`.

## Sécurité et limites

- Aucun token App, secret PEM, writer, nouvelle branche/ref ni appel OpenRouter n'est ajouté à cette PR. Le lecteur HTTP est limité à six familles de GET GitHub fixées au repository.
- Les tests injectent de faux clients GitHub ; une simulation verte ne certifie pas les permissions effectives de l'App installée. Le propriétaire doit approuver séparément le futur job writer et les tests de refus réels.
- La lecture de run ne suffit pas à authentifier les inputs ; la capture native de `GITHUB_EVENT_PATH` au runner de la branche protégée reste indispensable.
- Si le ref existant a un historique, les codes de rejet bloquent sa remise à zéro. En cas de réponse réseau ambiguë, pas de retry automatique.

## État GitHub constaté le 17 octobre 2026

Les rulesets `#25316890` et `#25316926` ciblent désormais **exactement** `refs/heads/asf/control/active-wave-v3`, ont les types `creation+update` / `deletion+non_fast_forward` et les bypass attendus. L'owner confirme que l'environnement `asf-v3-controller` et sa variable App ID sont configurés. **Le ref global opérationnel est encore absent (404 observé) et aucun bootstrap live n'est lancé.**

## Reste à faire avant une genèse réelle

- Implémenter dans un **module et un job privilégié audités séparément** la création atomique unique du registre : ref absent, identité contrôleur App installée, token éphémère limité au dépôt, vérification à la réponse et relecture de commit+tree+registry, zéro retry après réponse ambiguë.
- Pratiquer les tests négatifs GitHub réels sur un dépôt de test isolé (agent V1 ne peut pas créer la branche, contrôleur ne peut ni supprimer ni forcer un historique divergent).
- Écrire puis auditer le writer terminal RELEASE/QUARANTINE, le dispatch/ACK/CLAIM_CHILD, et le mutex payé partagé V1/V3 avant pilote OpenRouter.

Suivi : [issue #86](https://github.com/cedricmenec/threadstep/issues/86). Guide : [Notion ASF Controller V3](https://app.notion.com/p/3fc12ac9163681eb8dacca65bdbfc882).