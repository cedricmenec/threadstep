# ASF-V3-030 | Audit read-only des frontières GitHub Apps V1/V3

**État : contrôle de structure, sans secret et sans autorité réelle.** Suite de [ASF-V3-029](./v3-pr-stack-reconciliation.md). Aucune installation App, aucun jeton, aucune création de ref, aucune dépense ni workflow de production.

## Ce qui a été vérifié sur l'API GitHub, 18 octobre 2026

- HEAD `main` à l'observation : `67241c4b456065bccf4e48776cf1ba4366f52bb6`, susceptible d'évoluer. Les SHA de backlog et d'ensemble candidats doivent être recalculés au moment d'un vrai mandat.
- Les **trois** rulesets actifs de `threadstep` : `25163425` protège `refs/heads/main` (PR, CI requise, deletion et non-fast-forward) ; `25316890` protège création et modification du registre global, avec **unique bypass** Integration `5361227` / `always` ; `25316926` protège suppression et non-fast-forward global **sans bypass**. Les règles globales sont conformes **structurellement**.
- **Aucun ruleset actif n'est dédié à `refs/heads/asf/waves/*`**, donc les écritures de vague et les futurs ports ACK/CLAIM restent **bloqués**. Le ref `refs/heads/asf/control/active-wave-v3` est absent (404), ce qui n'accorde aucun droit de création.
- L'identité publique de l'App contrôleur attendue est `5361227`, distincte de l'App exécuteur V1 `5321746`. Un ID dans le bypass prouve uniquement ce qui est **configuré dans le ruleset**, pas les permissions effectives ni le périmètre d'un jeton délivré.
- La connexion utilisée pour les lectures REST des rulesets n'a pas accès aux informations d'installation/jetons ni aux endpoints d'administration de l'App. L'audit ne peut donc **pas** conclure `App controller has effective write` ni `App executor is denied`.

## Implémentation purement read-only

`scripts/asf/v3/github-app-permission-readiness.mjs` combine les observateurs existants des trois rulesets globaux et des deux wave rulesets, capture `main` au SHA fourni, observe le ref global puis relit `main` pour refuser une course.

Les réponses `blocked` (wave rulesets absents), `uncertain` (lecture ou race douteuse), `rejected` et `structurally_observed_not_authorized` conservent **tous** les droits `false`. Un éventuel `structurally_observed_not_authorized` avec cinq rulesets n'est jamais une autorisation de token, écriture, merge, OpenRouter ou retry.

## Matrice des tests de permissions **restant à exécuter avec accord propriétaire distinct**

1. **Sur un dépôt de test dédié** avec mêmes deux catégories de rulesets et refs de test, observer les scopes effectivement demandés par les GitHub App installation tokens, sans publier les secrets ni leurs valeurs dans le chat ou dans les logs.
2. Confirmer par tests négatifs que l'App exécuteur `5321746` et `GITHUB_TOKEN` n'ont **aucun droit** de création/modification du registre global ni des refs de vague protégées.
3. Confirmer que l'App contrôleur `5361227` peut effectuer seulement le **fast-forward non forcé attendu**, et qu'elle ne peut ni supprimer ni force-push grâce au ruleset immuable indépendant.
4. Vérifier qu'un jeton App à installation multi-dépôts reste **scopé au dépôt courant**, et que l'App exécutrice d'un autre dépôt n'obtient jamais le bypass V3. Tester la portée réelle des jetons sans exposer le PEM.
5. Ne jamais faire ces tests sur le ref opérationnel, ni activer OpenRouter. Réconcilier toute erreur `403`, `409`, `422`, timeout ou réponse perdue avec un arrêt sans retry.
6. Avant un premier vrai job payé, imposer owner run authentifié, six inputs figés, double lecture de la décision, registre durable, `ACK/CLAIM_CHILD` puis mutex partagé `threadstep-paid-development-v1` au job payé seulement, quotas 1..10 et aucune relance payante.

## Opérations administrateur bloquantes à ce stade

**Deux rulesets de vague** restent à créer, *après décision administrative explicite et audit de leur compatibilité avec les règles du dépôt*, sur `asf/waves/*` avec pattern API attendu `refs/heads/asf/waves/*` :

- Writer : creation+update, bypass seul Integration `5361227`, `always`.
- Immutabilité : deletion+non_fast_forward, aucun bypass.

Leur configuration doit être contrôlée via les endpoints GitHub REST après création. Cette PR ne les crée **pas**.

**Aucune action propriétaire supplémentaire n'est demandée pour fusionner cette documentation**, qui reste en brouillon. Les actions administratives et tout transport d'un token privé restent non autorisées par défaut.
