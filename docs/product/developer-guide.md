# ThreadStep — documentation développeur

**Application pilote, état 16 octobre 2026 :** TS-012, TS-013 et TS-014 livrées par les PR [#55](https://github.com/cedricmenec/threadstep/pull/55), [#58](https://github.com/cedricmenec/threadstep/pull/58), [#59](https://github.com/cedricmenec/threadstep/pull/59). La dernière CI et Pages sur `main` sont réussies. Les essais matériels demeurent distincts des tests Node.

## Architecture

ThreadStep est une application **statique**, en JavaScript vanilla sans build front-end ni backend. `site/index.html` expose les formulaires et les zones d'affichage ; `site/styles.css` gère le responsive ; `site/core.js` contient les fonctions pures du modèle ; `site/app.js` implémente le DOM, les événements, `localStorage`, JSON, focus, pointeurs et notifications.

```text
site/index.html
  ├─ site/styles.css
  ├─ site/app.js → site/core.js
  │             → site/dexie-foundation.js
  │             → site/vendor/dexie-cloud.mjs (Dexie.js + dexie-cloud-addon, buildé)
  ├─ site/dexie-foundation.js (validation d'URL, portail, schéma, configuration locale)
  └─ site/vendor/dexie-cloud.mjs
        ↕ localStorage du navigateur
        ↕ import / export JSON explicites
GitHub Pages publie uniquement site/ ; aucune API produit
```

CSP `connect-src https://*.dexie.cloud wss://*.dexie.cloud` : seuls les hôtes Dexie Cloud sont joignables ; aucun contenu des tâches n'est transmis avant configuration et consentement. Les valeurs utilisateur doivent devenir des nœuds texte, jamais du HTML interpolé. Un export JSON personnel doit rester local à l'utilisateur.

## Socle Dexie Cloud (TS-024)

Le socle local-first est amorcé par `site/dexie-foundation.js` : `validateCloudUrl` n'accepte qu'une URL HTTPS sous `dexie.cloud` (validation purement syntaxique, sans réseau), `shouldOpenSyncedDatabase` et `cloudConfigureOptions` produisent `{ databaseUrl, requireAuth: true }` sans désactiver `nameSuffix`, et `dexieSchema` déclare une version entière explicite avec des magasins synchronisés à identifiants uniques `@id` (jamais `++id`). L'URL est conservée en local sous la clé non synchronisée `threadstep.cloud.config.v1`, distincte de `threadstep.document.v1` et absente de l'export JSON. `site/app.js` ne construit et ne configure la base synchronisée que derrière `shouldOpenSyncedDatabase` ; sans URL valide, un formulaire de configuration accessible est présenté et aucune opération métier Dexie n'est exécutée. Les dépendances `dexie` et `dexie-cloud-addon` sont épinglées dans `package.json`/`package-lock.json` et livrées en ESM local `site/vendor/dexie-cloud.mjs` (`npm run vendor:build`), sans CDN tiers à l'exécution. Aucun secret, fichier `dexie-cloud.key`/`dexie-cloud.json`, jeton d'administration ni URL d'instance imposée ne doit être livré.

## Modèle de données

- Document versionné `threadstep.document.v1` dans le `localStorage`.
- Un document contient des **sujets** ordonnés ; chaque sujet contient un tableau `items`.
- Une action principale possède `parentId: null` ; une sous-tâche possède `parentId` égal à l'ID de son action principale. **Un seul niveau** d'imbrication.
- L'ordre des priorités est `urgent`, `normal`, `later`. À priorité égale, la position dans le tableau `items` détermine l'ordre. Réordonner un parent n'arrache pas ses enfants.
- Une action possède ID stable, titre, priorité et `done`. Le réordonnancement ne modifie que l'ordre dans le tableau : pas de nouvelle clé, pas de migration de schéma.
- La sélection de « Je reprends ici » est une préférence locale distincte, non exportée. L'état des parents repliés et la suppression annulable pendant 10 secondes sont éphémères par onglet ; ne pas les persister dans le document.

Les formats et leurs validations se trouvent dans `site/core.js` et `tests/core.test.mjs` ; consulter leur code avant toute migration.

## Fonctionnalités et contrats

| Besoin | Implémentation / comportement |
| --- | --- |
| Sujets et actions, priorité, terminer, modifier | `site/app.js` appelle les fonctions pures de `site/core.js` ; les données sont sauvegardées automatiquement |
| Une sous-tâche par parent | `parentId` et `visibleItems` ; filtre de complétion appliqué à l'affichage |
| Actions principales, ordre manuel | TS-011 : drag/pointer + « Monter / Descendre », même sujet et priorité |
| Repli des sous-tâches | TS-012/TS-021 : `expandedParents` par onglet (défaut replié), `substepView`, `toggleExpandedParent`, `isViewEntry`, `substepAncestorId`, `aria-expanded` |
| Libellé du repli | TS-013 : `substepToggleLabel`, « Voir N sous-tâches » **lorsque replié**, « Masquer les sous-tâches » **lorsque déplié** ; décompte des enfants visibles |
| Sous-tâches, ordre manuel | TS-014 : `reorderWithinPriority` et `moveWithinPriority` opèrent dans le groupe **même parent + même priorité**, sans déplacer d'autres groupes |
| Masquer les étapes terminées | Filtre visuel, ne modifie pas les données ; interdit les réordonnancements tant qu'il est actif |
| Retrait/annulation | TS-010 : suppression immédiatement persistée, retour arrière 10 secondes dans l'onglet (si non invalidé) |
| Suggestion / reprise | Calcul déterministe de la prochaine action ; suivi « Je reprends ici » distinct, fondé sur des IDs stables |
| Export/import JSON | Sauvegarde manuelle portable ; import contrôlé et confirmé avant remplacement |

Les sous-tâches masquées par repli **existent toujours** et conservent leur ordre ; une actualisation ou une entrée dans une vue replie les parents mais garde les réordonnancements sauvegardés.

## Développer et tester

```sh
npm run check
npm test
npm run backlog:check
node --check site/core.js
node --check site/app.js
```

La suite est basée sur `node --test tests/*.test.mjs`. Ne pas modifier `backlog/index.json` à la main : régénérer via `npm run backlog:index` après une fiche nouvelle/modifiée. Les changements UI doivent être testés sur ordinateur et mobile, avec clavier, lecteur d'écran si possible et viewport étroit : les tests Node purs ne simulent pas toute l'accessibilité du navigateur.

Toutes les modifications passent par une branche et PR ; les workflows CI et Pages fournissent une preuve indépendante après fusion. Les tâches produit `TS-NNN` sont spécifiées sous `backlog/tasks/` ; les spécifications canoniques OpenSpec vivent sous `openspec/specs/`, leur historique sous `openspec/changes/archive/`.

## Frontières de sécurité et évolution

**État courant du pilote :** le socle de configuration Dexie Cloud (TS-024) est intégré, mais aucune synchronisation opérationnelle ni authentification OTP n'est encore livrée (TS-025 à TS-030). Tant qu'aucune URL valide n'est enregistrée, aucune base synchronisée n'est ouverte et les données restent dans le navigateur. La CSP n'autorise que les hôtes Dexie Cloud. Cette progression est **additive** : le document `threadstep.document.v1` et ses exports restent inchangés.

**Cible Dexie Cloud, non déployée :** la
[spécification normative](specs/dexie-cloud-local-first.md)
autorise et exige dans son périmètre IndexedDB/Dexie.js,
authentification OTP email native et synchronisation.
Le [plan de livraison](dexie-cloud-rollout.md) demande des origines
et URL contrôlées, une CSP adaptée sans ouverture superflue,
aucun secret côté client, une migration non destructive et
le consentement avant transfert des anciennes données.
Les clés OpenRouter restent réservées à la **factory** sur GitHub
Actions. Aucun format JSON incompatible ne doit être livré
sans migration et vérification explicites.

## Documentation liée

[Guide utilisateur](guide-utilisation.md) · [Exigences MVP historiques](mvp.md) · [Cible Dexie Cloud](specs/dexie-cloud-local-first.md) · [Recette fonctionnelle](acceptance-checklist.md) · [Vision](vision.md) · [Architecture générale](../architecture.md) · [ASF développeur](../factory/developer-guide.md).
