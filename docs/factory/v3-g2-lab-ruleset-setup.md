# ASF V3 | Contrat de qualification des rulesets du laboratoire

Date : 23 octobre 2026. **Plan de configuration seulement : aucune action privilégiée exécutée.**
Laboratoire : https://github.com/cedricmenec/asf-v3-ruleset-lab.

## Constat GitHub REST

- Dépôt public, non archivé, propriétaire `cedricmenec`, distinct de `threadstep`.
- Branche `main` créée au SHA `81e74302803a09922e33929748446eab43f30fe2` et non protégée au contrôle.
- API `GET /repos/cedricmenec/asf-v3-ruleset-lab/rulesets?per_page=100&page=1` = **200**, liste vide `[]`.
- Les Apps ASF Controller V3 ID `5361227` et Executor V1 ID `5321746` ne sont **pas** attestées installées sur ce dépôt par la connexion ChatGPT.
- La création du dépôt et le statut public ne constituent ni une preuve de permissions effectives ni une autorisation de créer des règles, références ou secrets.

## Préflight sans privilège

Depuis la branche canonique de [PR #183](https://github.com/cedricmenec/threadstep/pull/183) :

```sh
node scripts/asf/v3/g2-lab-readonly-eligibility.mjs cedricmenec/asf-v3-ruleset-lab
node scripts/asf/v3/g2-lab-ruleset-policy.mjs cedricmenec/asf-v3-ruleset-lab
```

Le premier contrôle attend `candidate_only` avec `rulesetCount:0`. Le second attend `not_configured`, `lab_rulesets_absent`, code de sortie non zéro. Après configuration conforme, le second doit retourner `structure_observed_not_authorized` : ce n'est pas G2/G3 PASS.

## Quatre rulesets de laboratoire proposés, **non appliqués**

Après approbation explicite des changements de sécurité, dans *Settings > Rules > Rulesets > New branch ruleset*, définir chacune des règles ci-dessous. Toutes ont `target=branch`, `source_type=Repository`, `enforcement=active` et **aucune exclusion**. Notation API pour les cibles.

| Nom exact | Branch include | Règles | Bypass |
| --- | --- | --- | --- |
| `ASF V3 LAB - Global controller writer` | `refs/heads/asf/lab/control/active-wave-v3` | `creation`, `update` seulement | App Controller V3 `5361227`, `Integration/always` seule |
| `ASF V3 LAB - Global immutable history` | `refs/heads/asf/lab/control/active-wave-v3` | `deletion`, `non_fast_forward` seulement | aucun |
| `ASF V3 LAB - Wave controller writer` | `refs/heads/asf/lab/waves/*` | `creation`, `update` seulement | App Controller V3 `5361227`, `Integration/always` seule |
| `ASF V3 LAB - Wave immutable history` | `refs/heads/asf/lab/waves/*` | `deletion`, `non_fast_forward` seulement | aucun |

Ne jamais ajouter de bypass admin/propriétaire temporaire ni permettre au Controller de contourner les deux règles d'immuabilité. Garder les quatre règles indépendantes et leur liste exhaustive. Lire ensuite chaque détail REST, son ID, sa cible, ses exclusions, règles et bypass, avant d'interpréter le résultat de l'observateur.

## Installations Apps : encore non autorisées

Le connecteur ChatGPT n'a pas accès à la gestion des installations ASF. La liste de ses propres installations ne démontre rien pour les Apps Controller/Executor. Avant toute intervention, vérifier l'App ID, l'installation ID, les permissions effectivement accordées et les dépôts visibles, sans publier de jeton/PEM. Les modifications de permissions d'une App peuvent toucher d'autres dépôts : ne jamais élargir globalement les droits de l'Executor uniquement pour faire passer un test.

Un refus 403 d'un jeton sans `contents:write` ne prouve pas le fonctionnement d'un ruleset. G3-01 requiert un véritable refus GitHub attribuable aux règles, en présence d'un droit d'écriture par ailleurs applicable.

## Conditions des futurs tests G3

- Avant toute opération sur les refs protégées du laboratoire, demander une autorisation **distincte**, avec scope précis, identité de la GitHub App et périmètre des branches `asf/lab/*`.
- Ne pas modifier `main`, les références opérationnelles `threadstep`, les secrets ni les workflows payants ; ne pas exécuter de modèle ou de jobs facturables sans approbation.
- Les scénarios G3-01 à G3-10 et leurs critères de preuves sont décrits dans [le plan G2/G3](v3-g2-g3-live-qualification-plan.md).
- Un support CAS **durable et protégé distinct** devra déjà exister pour écrire `BEGIN_CREATE_ATTEMPT` avant le tout premier CREATE de la ref globale. Les quatre règles ci-dessus ne valident pas à elles seules ce support. Ne pas inventer de permission à partir d'un 404.
- Une réponse à une écriture perdue ou ambiguë bloque tout retry automatique et impose quarantaine.

État : **LAB CANDIDATE**, **0/4 rulesets**, **G2/G3 NOT PROVEN**, **G4 NO-GO**. Références : [ASF-V3-043](tasks/ASF-V3-043.md), [issue #86](https://github.com/cedricmenec/threadstep/issues/86), [Notion](https://app.notion.com/p/3fc12ac9163680adb3e3e3f63d827f69).
