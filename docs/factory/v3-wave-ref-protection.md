# ASF-V3-026 — Protection des refs de vague distincte du registre global

**Statut : préflight de sécurité read-only, PR brouillon sur #112. Aucun changement de ruleset administré par le développeur.**

## Problème de sécurité confirmé

Les trois rulesets GitHub observés dans `cedricmenec/threadstep` protègent **main** et le ref global unique **`refs/heads/asf/control/active-wave-v3`**. Ils ne prouvent PAS une restriction en écriture sur les branches `refs/heads/asf/waves/*` utilisées par les journaux de vague et leurs transitions `ACK_CHILD` et `CLAIM_CHILD`.

Un résultat CAS structurellement correct sur un journal que l'App exécuteur pourrait modifier ou forcer ne doit jamais constituer une preuve suffisante de contrôle global. Il faut séparer la capacité d'écriture du contrôleur (App `5361227`) de celle de l'exécuteur (App `5321746`) sur les **deux familles de ref**.

## Contrat d'activation supplémentaire V3

Créer, **avec décision propriétaire**, deux rulesets GitHub pour la cible de branches *exacte* : `refs/heads/asf/waves/*`. Le champ UI `Include by pattern` doit normalement recevoir **`asf/waves/*`** si GitHub ajoute automatiquement `refs/heads/`.

**Règle 1 : `ASF V3 — Wave controller writes`**

- Target branches → Include by pattern : `asf/waves/*` (vérifier GET API = `refs/heads/asf/waves/*`).
- `Restrict creations` + `Restrict updates` uniquement.
- Un unique bypass : **Integration `ASF Controller V3`, App ID `5361227`, `always`**.
- `Enforcement`: `Active`. Aucun bypass pour App V1 `5321746` ni utilisateur, équipe ou autre App.

**Règle 2 : `ASF V3 — Wave immutable history`**

- Même pattern de branches exact.
- `Restrict deletions` + `Block force pushes` (`deletion` + `non_fast_forward`).
- **ZÉRO bypass**, y compris pour l'App `5361227`.
- `Enforcement`: `Active`. Ne jamais combiner l'immutabilité avec le bypass writer : il permettrait alors de contourner cette immutabilité.

### Vérification indépendante obligatoire

Après création, lire chaque ruleset par GitHub REST et vérifier `conditions.ref_name.include` exactement égal à `["refs/heads/asf/waves/*"]`. Une règle Active sur un motif `refs/heads/refs/heads/...` ne protège pas le ref attendu. Tester avec des identités GitHub distinctes **dans un dépôt expérimental ou avec des refs de test approuvés**, jamais sur le registre réel :

- Un token de l'App exécuteur V1 ne peut ni créer ni modifier une branche de vague.
- L'App contrôleur peut créer une branche de vague et effectuer un fast-forward normal sur son journal, mais ne peut ni la supprimer ni faire un force-push divergent.
- Aucun `GITHUB_TOKEN` de workflow enfant ne peut modifier une branche de vague.
- Une collision entre deux commits frères est bloquée, et toute réponse ambiguë stoppe sans retry.

## Code ajouté

`scripts/asf/v3/github-native-wave-ruleset.mjs` rejette un writer combiné à l'immutabilité, un mauvais pattern, des règles inactives, un bypass d'un autre App ID, les motifs ambigus et les règles absentes. Il lit tous les détails GitHub REST, sans modifier les règles.

`scripts/asf/v3/github-native-child-wave-cas.mjs` **refuse maintenant toute tentative d'ACK/CLAIM** si les deux règles ne sont pas observées et revalidées juste avant le premier POST Git Data. Même en simulation, les tests prouvent que l'absence de protections empêche la mutation du journal.

Tout résultat reste **non autorisant** : pas de clé App réelle, de workflow privilégié, de modification Git opérationnelle ou d'OpenRouter. Les règles structurelles ne suffisent pas sans tests de permissions effectives.

## Actions owner

La mise en place des deux rulesets de vague est une nouvelle action propriétaire **requise avant tout bootstrap/admission d'une vraie vague avec agent**. Le développement de modules read-only et simulations reste possible sans elle. Ne pas créer les refs opérationnels, activer de clés ou lancer des appels payants avant l'audit.

Voir [Notion ASF V3](https://app.notion.com/p/3fc12ac9163681eb8dacca65bdbfc882) et [issue #86](https://github.com/cedricmenec/threadstep/issues/86).