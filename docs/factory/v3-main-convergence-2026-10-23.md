# ASF V3 | C4e : convergence Git non privilégiée du 23 octobre 2026

**Statut : brouillon, pas de mise en service.** Issue de contrôle : [#86](https://github.com/cedricmenec/threadstep/issues/86), [plan Notion](https://app.notion.com/p/3fc12ac9163680adb3e3e3f63d827f69).

## Trois points d'ancrage

| Objet Git | SHA |
| --- | --- |
| `main` après #176 et #182 | `388f02307bdcdc93e3dfb88ce09d184c1994a8b1` |
| Pile ASF V3 #169 → #177 → #178 → #179 → #180 → #181 | `8ba8f93ae7c455cbb54478daf828d97f463f6a86` |
| Ancêtre commun | `10ab810a6af520041774d52980f568f2522d40a6` |
| Tree de convergence vérifié | `65fff95f72e4833a16ec827f0fc93db3db7a578f` |
| Commit merge à deux parents | `ab7c4adb4f5118c0c162dee4708aa2e8f2e5d472` |

Le diagnostic pré-écriture a comparé `git/trees?recursive=1` des trois états, avec `truncated=false`. Les 6 collisions apparentes sur `.github`, `docs`, `tests` étaient des **objets répertoire** `type:tree`, pas des fichiers. L'analyse des feuilles vérifiées (type, mode et SHA) n'a trouvé **aucune collision de blob**.

- `main` : 591 feuilles, dont 48 modifiées exclusivement par rapport à l'ancêtre ; les évolutions V1, CI/OpenCode, produit TS-051/TS-052 et documentations #176/#182 sont conservées.
- Pile V3 : 678 feuilles ; 117 modifications de blobs exclusivement V3 apportées à la convergence, aucune suppression ni collision.
- **Tree fusionné** : 708 feuilles ; vérification exhaustive des chemins et des triplets SHA/mode/type avant création de commit ; 0 mismatch.
- Merge commit construit avec deux parents dans l'ordre `main` puis V3 ; aucune mutation de ref opérationnelle. La PR brouillon est la seule voie candidate future vers main, **et non une autorisation de fusion**.

## Ordre de revue et livraison

1. Confirmer la CI du SHA final de la PR C4e (Node, actionlint, OpenSpec) et l'absence de regressions entre V1 et V3.
2. Valider après correction G1 les cinq rulesets REST et les **refus effectifs** GitHub avec les tokens des Apps V1/Controller dans un laboratoire éligible.
3. Préparer et faire approuver le writer G2, les secrets et un protocole d'intention durable, avant tout bootstrap Git.
4. Qualifier les cas G3 (CAS concurrent, réponse perdue, tentatives croisées, cancellation, RELEASE et QUARANTINE) sans LLM.
5. Une fois les autorisations sensibles obtenues, fusionner **une seule tête canonique** ; ne pas fusionner rétroactivement les PR empilées. Vérifier CI/Pages sur main après fusion.

## Risques et garde-fous

Les workflows V3 sont encore volontairement fail-closed. La seule observation d'un `404` sur le registre global ne permet pas sa création. L'App V1 (5321746) n'est jamais admise comme writer du registre ou journal V3. Le mutex `threadstep-paid-development-v1` et `maxPaidRetries=0` restent exigés avant une exécution payante. **Aucun secret, ruleset, ref protégé, dispatch ou appel OpenRouter n'a été engagé par cette convergence.**
