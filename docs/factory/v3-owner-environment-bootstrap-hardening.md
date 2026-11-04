# ASF-V3-018 — Environnement owner et observateur de bootstrap

**17 octobre 2026 — PR de préparation non payante et sans accès aux secrets, empilée sur #100.**

## Ce qui est implémenté

- Le job owner V3 existant référence désormais l'environnement GitHub `asf-v3-controller` déclaré créé par le propriétaire, sans lire de secret.
- La seule variable supplémentaire est `ASF_V3_CONTROLLER_APP_ID`, tirée des variables de l'environnement GitHub. Le préflight exige strictement la chaîne `5361227` (App V3). Une valeur absente, incorrecte ou l'App V1 `5321746` bloque avant toute observation privilégiée.
- Les permissions du workflow restent `contents: read` et `actions: read`. Aucune action `create-github-app-token` ni référence à un secret n'est présente. La dernière étape est toujours un refus explicite des writes, du dispatch et du paiement.
- L'observateur bootstrap reconnaît les deux formats de `404` GitHub (statut de réponse ou `error.status` normalisé), mais ne le transforme JAMAIS en autorisation de créer le registre. Les réponses contradictoires, erreurs 403/422/503 et les changements de ref sont incertains.

## Contrôle GitHub réel : deux cibles incorrectes

| Ruleset | Champ `conditions.ref_name.include[0]` réellement enregistré |
|---|---|
| [Writer #25316890](https://github.com/cedricmenec/threadstep/rules/25316890) | `refs/heads/refs/heads/asf/control/active-wave-v3` |
| [Immutable #25316926](https://github.com/cedricmenec/threadstep/rules/25316926) | `refs/heads/refs/heads/asf/control/active-wave-v3,` |

La valeur EXACTE attendue pour chacun est `refs/heads/asf/control/active-wave-v3`. GitHub a ajouté automatiquement un préfixe `refs/heads/`, et une virgule finale subsiste dans la seconde règle.

**Les règles et les identités sont correctes, les cibles ne le sont pas** : la writer contient maintenant `creation` et `update`, avec unique bypass Integration App ID `5361227` en mode `always`. L'immuable contient `deletion` et `non_fast_forward`, sans bypass.

Dans GitHub Settings → Rules → Rulesets → Edit → Target branches → Include by pattern, effacer le motif existant puis saisir seulement `asf/control/active-wave-v3` si l'interface ajoute le préfixe. Enregistrer, puis vérifier les réponses API :

- [GET writer 25316890](https://api.github.com/repos/cedricmenec/threadstep/rulesets/25316890)
- [GET immutable 25316926](https://api.github.com/repos/cedricmenec/threadstep/rulesets/25316926)

**Ne pas faire le bootstrap tant que les deux cibles n'ont pas été corrigées et relues indépendamment.** La connexion GitHub actuelle permet de consulter les règles, mais ne dispose pas d'action de modification administrative des rulesets.

## À faire manuellement

1. Corriger les deux patterns, sans toucher aux exemptions, puis signaler que c'est fait.
2. Dans [GitHub → Settings → Environments](https://github.com/cedricmenec/threadstep/settings/environments), contrôler l'environnement `asf-v3-controller` : accès limité à la branche `main` et, selon les options du plan GitHub, revue requise.
3. Créer la variable d'environnement **non secrète** `ASF_V3_CONTROLLER_APP_ID` = `5361227`. La présence effective de cette variable n'est pas vérifiable ici.
4. **Ne pas encore ajouter la clé PEM** à cet environnement tant que le futur job writer privilégié n'a pas été relu et explicitement approuvé. Aucun PEM ni secret dans Notion/ChatGPT.
5. Revoir la politique d'approbation des changements de workflows sur `main` : l'API GitHub indique actuellement `required_approving_review_count: 0`. Ce réglage n'impose pas de revue humaine indépendante avant d'exposer une clé privilégiée.

## Ce qui reste en développement

Transaction Git de genèse one-shot via App contrôleur, writer global CAS terminal RELEASE/QUARANTINE, dispatch/ACK/CLAIM_CHILD, mutex partagé V1/V3, tests GitHub réels sans paiement. Tout bootstrap live, privilège et paiement nécessite autorisation séparée. Le présent lot n'en donne aucune.

Procédure générale : [Notion ASF — Guide de l'App contrôleur](https://app.notion.com/p/3fc12ac9163681eb8dacca65bdbfc882).