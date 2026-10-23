# ASF V3 | G1 : audit GitHub réel du 23 octobre 2026

**État : NO-GO structurel.** Rapport de faits API à une date donnée, ne constituant pas une autorisation opérationnelle. Suivi vivant : [Plan ASF V3 dans Notion](https://app.notion.com/p/3fc12ac9163680adb3e3e3f63d827f69) et [issue #86](https://github.com/cedricmenec/threadstep/issues/86).

## Données vérifiées

Repository `cedricmenec/threadstep`. Branch `main` : `ef86b5825b3bdd358d53879a6634afe36f18bd22` au contrôle. Cinq règles actives, toutes de type branche, source exacte `cedricmenec/threadstep` et exclusions vides.

| Règle | ID | Motif API | Types | Bypass | Verdict |
| --- | --- | --- | --- | --- | --- |
| [Main](https://github.com/cedricmenec/threadstep/rules/25163425) | 25163425 | `refs/heads/main` | deletion, non_fast_forward, pull_request, required_status_checks `check` | aucun | Conforme structurellement |
| [Global writer](https://github.com/cedricmenec/threadstep/rules/25316890) | 25316890 | `refs/heads/asf/control/active-wave-v3` | creation, update | Integration 5361227, always | Conforme structurellement |
| [Global immutable](https://github.com/cedricmenec/threadstep/rules/25316926) | 25316926 | `refs/heads/asf/control/active-wave-v3` | deletion, non_fast_forward | aucun | Conforme structurellement |
| [Wave writer](https://github.com/cedricmenec/threadstep/rules/25747770) | 25747770 | `refs/heads/asf/waves/*` | **deletion, non_fast_forward**, creation, update | Integration 5361227, always | **Non conforme** |
| [Wave immutable](https://github.com/cedricmenec/threadstep/rules/25747923) | 25747923 | `refs/heads/asf/waves/*` | deletion, non_fast_forward | aucun | Conforme structurellement |

Le writer wave ne doit pas porter lui-même les deux types immuables : cela mélange un bypass contrôleur avec la garantie d'historique. La règle indépendante d'immutabilité, sans bypass, doit rester en place. La conception ASF exige **exactement** deux règles dans le writer et exactement deux dans l'immuable.

**Action administrateur limitée à #25747770** : décocher `Restrict deletions` et `Block force pushes`. Conserver `Restrict creations`, `Restrict updates`, le motif existant et l'unique bypass Controller V3 5361227. Ne changer aucune autre règle. Faire ensuite une nouvelle lecture REST détaillée des cinq rulesets.

## Registre et permissions

La ref globale `refs/heads/asf/control/active-wave-v3` retourne HTTP 404 au contrôle. **Ce 404 n'autorise jamais sa création** : il peut masquer des droits insuffisants et ne prouve pas l'identité du writer. Aucune genèse, modification du ref, écriture CAS ou dépense n'a été réalisée.

Un contrôle des champs `Integration 5361227` dans un ruleset n'authentifie pas la permission réelle du jeton de l'App installée. L'App Executor V1 `5321746` doit être incapable d'écrire les refs globales/wave ; seul le Controller V3 `5361227` peut suivre le CAS sur chemin owner audité, une fois la recette négative réelle démontrée.

## Laboratoire G3 et restrictions

Le dépôt privé de mutex `cedricmenec/asf-v3-mutex-lab` possède des [preuves M01 à M07](https://github.com/cedricmenec/asf-v3-mutex-lab/blob/main/evidence/ASF-V3-M01-M07-2026-10-18.md) de concurrence GitHub Actions **sans LLM ni secret**. Néanmoins, `GET /repos/cedricmenec/asf-v3-mutex-lab/rulesets` retourne actuellement **403**, avec indication de changement d'abonnement ou de visibilité pour disposer des rulesets. Cela n'invalide pas M01–M07, mais empêche de présumer une recette ruleset live dans ce laboratoire privé tel quel. Ne jamais le rendre public ni modifier l'abonnement sans décision propriétaire.

**Suite G3** : disposer d'un environnement qui supporte effectivement deux rulesets distincts et les tokens d'installation de chaque App, puis contrôler sur de **nouvelles refs de laboratoire**, jamais les refs opérationnelles, le refus V1 de créer/modifier/supprimer, le refus de force-push/delete même par le contrôleur, l'unique CAS gagnant, le readback après réponse perdue et l'absence de retry payé. Les secrets et tokens ne doivent figurer ni dans le rapport ni dans les logs publics.

## Code et CI préparés

La conception C4 est livrée via [PR #176](https://github.com/cedricmenec/threadstep/pull/176). La stack préparatoire sensible reste en brouillon, non activée : [#169](https://github.com/cedricmenec/threadstep/pull/169) → [#177](https://github.com/cedricmenec/threadstep/pull/177) → [#178](https://github.com/cedricmenec/threadstep/pull/178) → [#179](https://github.com/cedricmenec/threadstep/pull/179) → [#180](https://github.com/cedricmenec/threadstep/pull/180) → [#181](https://github.com/cedricmenec/threadstep/pull/181). Chaque PR de durcissement #177–#181 a eu une CI indépendante verte sur son SHA, mais cela ne démontre pas le comportement privilégié de GitHub.

**NO-GO maintenu** pour bootstrap live, activation de secret, modifications de permissions, fusion sensible ou pilote payant. Les approbations G2, G3 et G4 sont séparées.