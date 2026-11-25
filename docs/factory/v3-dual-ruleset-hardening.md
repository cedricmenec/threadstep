# ASF-V3-016 — Règles GitHub distinctes : writer et intégrité
**État : qualification en PR brouillon — aucun droit réel modifié.**
Chaîne de travail : [#87](https://github.com/cedricmenec/threadstep/pull/87) → [#96](https://github.com/cedricmenec/threadstep/pull/96) → [#97](https://github.com/cedricmenec/threadstep/pull/97) → V3-016.

## Risque corrigé
La version initiale de `inspectV3GithubRulesets` pouvait considérer « structurellement cohérent » un **seul ruleset global** réunissant `update`, `deletion`, `non_fast_forward` et un bypass pour l'App contrôleur. Ce schéma **n'assure pas** la propriété voulue : le bypass est donné à l'**identité** de l'App pour le ruleset entier et peut donc également permettre de contourner la suppression et la réécriture forcée. En outre, réutiliser l'App V1 serait dangereux car V1 et l'agent disposent déjà de jetons `contents: write` de cette identité.

La solution est de **séparer les contraintes en deux rulesets indépendants**, cumulative pour le même ref exact `refs/heads/asf/control/active-wave-v3` :

| Ruleset | Règles | Bypass |
|---|---|---|
| `ASF V3 — Only controller may update` | Uniquement `Restrict updates` (`update`) | Exactement **une** GitHub App contrôleur (Integration, `bypass_mode: always`) |
| `ASF V3 — Immutable history` | `Restrict deletions` (`deletion`), `Block force pushes` (`non_fast_forward`) | **Aucun**, y compris pas l'App contrôleur |

Le ruleset main existant doit garder ses protections `pull_request`, `required_status_checks` (contexte check), `deletion` et `non_fast_forward`, sans bypass.

## Changement du vérificateur
- `inspectV3GithubRulesets({main,global,immutable})` exige une règle writer limitée à `update` et une règle de sécurité **sans bypass** limitée à `deletion`/`non_fast_forward`, même ref exact, source dépôt, `enforcement: active`, identités distinctes des rulesets.
- `observeV3GithubRulesetPolicy` relit la **liste et chaque détail** GitHub ; exige exactement **deux** règles globales reconnues. Une seule règle combinée, un doublon, l'absence d'une règle, un bypass partiel `pull_request` ou une règle `evaluate` sont rejetés.
- L'ID d'App lu sur GitHub est seulement **observé**. Aucun appelant ne peut le substituer à l'ID approuvé par le propriétaire ; le pinning réel et les droits installation sont P0 extérieurs.
- Tous les modules bootstrap, admission, livraison et contrôle terminal réutilisent l'observation commune ; leurs simulations sont mises à jour pour deux rulesets.
- Même succès : `authorized:false`, `canWrite:false`, `canSpend:false`. Aucun token, workflow, ruleset réel ni paiement dans cette PR.

## Vérifications manuelles restantes
1. Sur GitHub, créer/installer l'App `ASF Controller V3` avec permissions minimales, distincte de l'App V1. Une App peut être réutilisée entre dépôts avec **sélection de repositories** et tokens installation scindés ; aucune clé privée dans Notion ou chat.
2. Créer **deux** rulesets actifs à cible identique et tester les refus sur dépôt de test isolé : l'App V1/agent ne peut pas écrire le ref, l'App contrôleur ne peut ni supprimer ni forcer l'historique.
3. Lier l'identité App approvée au workflow owner protégé, enregistrer la clé uniquement dans un environnement protégé, capturer les six inputs directs du run `workflow_dispatch`. Ne pas donner à l'enfant l'environnement ou la clé.
4. Faire une revue indépendante des règles applicables, y compris les autres rulesets à portée plus large et les privilèges admin d'urgence, et tester les permissions réelles : les tests Node ne prouvent pas l'exécution GitHub.
5. Autorisation distincte avant merge de workflows privilégiés, bootstrap live, dispatch et OpenRouter.

## Références
- [GitHub — Creating rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)
- [GitHub — Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- [GitHub — Installing your own App](https://docs.github.com/en/apps/using-github-apps/installing-your-own-github-app)
- [Notice complète dans Notion](https://app.notion.com/p/3fc12ac9163681eb8dacca65bdbfc882)
