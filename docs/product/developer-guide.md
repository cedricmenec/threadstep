# ThreadStep — documentation développeur

**Application pilote, état 16 octobre 2026 :** TS-012, TS-013 et TS-014 livrées par les PR [#55](https://github.com/cedricmenec/threadstep/pull/55), [#58](https://github.com/cedricmenec/threadstep/pull/58), [#59](https://github.com/cedricmenec/threadstep/pull/59). La dernière CI et Pages sur `main` sont réussies. Les essais matériels demeurent distincts des tests Node.

## Architecture

ThreadStep est une application **statique**, en JavaScript vanilla sans build front-end ni backend. `site/index.html` expose les formulaires et les zones d'affichage ; `site/styles.css` gère le responsive ; `site/core.js` contient les fonctions pures du modèle ; `site/app.js` implémente le DOM, les événements, `localStorage`, JSON, focus, pointeurs et notifications.

```text
site/index.html
  ├─ site/styles.css
  └─ site/app.js → site/core.js
        ↕ localStorage du navigateur
        ↕ import / export JSON explicites
GitHub Pages publie uniquement site/ ; aucune API produit
```

CSP `connect-src 'none'` ; aucun contenu des tâches n'est transmis au serveur. Les valeurs utilisateur doivent devenir des nœuds texte, jamais du HTML interpolé. Un export JSON personnel doit rester local à l'utilisateur.

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
| Repli des sous-tâches | TS-012 : `collapsedParents` par onglet, `substepView`, `toggleCollapsedParent`, `aria-expanded` |
| Libellé du repli | TS-013 : `substepToggleLabel`, « Voir N sous-tâches » **lorsque replié**, « Masquer les sous-tâches » **lorsque déplié** ; décompte des enfants visibles |
| Sous-tâches, ordre manuel | TS-014 : `reorderWithinPriority` et `moveWithinPriority` opèrent dans le groupe **même parent + même priorité**, sans déplacer d'autres groupes |
| Masquer les étapes terminées | Filtre visuel, ne modifie pas les données ; interdit les réordonnancements tant qu'il est actif |
| Retrait/annulation | TS-010 : suppression immédiatement persistée, retour arrière 10 secondes dans l'onglet (si non invalidé) |
| Suggestion / reprise | Calcul déterministe de la prochaine action ; suivi « Je reprends ici » distinct, fondé sur des IDs stables |
| Export/import JSON | Sauvegarde manuelle portable ; import contrôlé et confirmé avant remplacement |

Les sous-tâches masquées par repli **existent toujours** et conservent leur ordre ; une actualisation rouvre les parents mais garde les réordonnancements sauvegardés.

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

## Frontières de sécurité

Pas de compte, de synchronisation cloud, de télémétrie, de dépendance serveur, d'IA front-end ou de nouvelle version JSON sans migration approuvée. Les clés OpenRouter sont uniquement utilisées par la **factory**, dans GitHub Actions. L'application finale ne les reçoit jamais.

## Documentation liée

[Guide utilisateur](guide-utilisation.md) · [Exigences MVP](mvp.md) · [Recette fonctionnelle](acceptance-checklist.md) · [Vision](vision.md) · [Architecture générale](../architecture.md) · [ASF développeur](../factory/developer-guide.md).
