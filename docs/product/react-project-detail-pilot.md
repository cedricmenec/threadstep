# Bilan du pilote React — détail projet (TS-059)

**Date des mesures :** 24 octobre 2026
**Périmètre :** route `#/sujet/<id>` uniquement. Aucune autre vue n'est migrée.
**Décision : GO** pour le pilote, sous réserve de la recette manuelle listée
plus bas. Ce GO ne planifie ni n'autorise automatiquement la migration
d'Overview, de Paramètres, de la Synchronisation, du design system ou de
Tailwind.

## Livraison effective et vérification du site public (24 octobre 2026)

- [PR TS-059 #200](https://github.com/cedricmenec/threadstep/pull/200) fusionnée au commit `bde2e5d62cfb415c82f3e19131dcfbd77e566927`.
- [CI de `main` réussie](https://github.com/cedricmenec/threadstep/actions/runs/40103243753) et [GitHub Pages déployé](https://github.com/cedricmenec/threadstep/actions/runs/40103243815) depuis le même SHA, via le build Vite `dist/`.
- Smoke test manuel non destructif sur le site public, dans un navigateur isolé **sans instance Dexie Cloud** : création d'un projet de test en IndexedDB locale, ouverture du détail `#/sujet/<id>`, création puis complétion d'une tâche, avec compteurs et état visuel cohérents.
- La parité graphique est attendue : les styles, classes et libellés sont conservés. Aucun changement visible n'est un indicateur de défaut de déploiement. Le gain actuel est l'architecture React limitée au détail du projet.
- Ce smoke test ne couvre pas Chrome Android réel, la navigation clavier complète, les gestes tactiles, le lecteur d'écran, les données personnelles du propriétaire, l'isolation multi-comptes ni la convergence Dexie Cloud. Ces validations ne sont pas revendiquées.

## Commandes de mesure

```sh
npm run build
node -e '… taille de dist/assets, du chunk app-*.js et du CSS …'
node --test --experimental-test-coverage tests/ts-059-project-detail-*.test.mjs
node --test tests/ts-059-project-detail-render.test.mjs \
  tests/ts-059-project-detail-commands.test.mjs \
  tests/ts-059-project-detail-integration.test.mjs \
  tests/ts-059-project-detail-continuity.test.mjs \
  tests/ts-059-project-detail-docs.test.mjs
```

Les références « avant » ont été prises après `npm run build` avant toute
édition du pilote et conservées dans `/tmp/ts-059-build-baseline.json` et
`/tmp/ts-059-code-baseline.json`.

## Poids du build

| Mesure | Avant | Après | Écart |
| --- | ---: | ---: | ---: |
| Total `dist/assets` | 690 229 octets | 936 456 octets | +246 227 octets (+35,7 %) |
| Chunk applicatif `app-*.js` | 311 945 octets | 558 172 octets | +246 227 octets |
| CSS | 36 285 octets | 36 285 octets | 0 octet |

Le runtime React et la surface du détail sont désormais présents dans le chunk
applicatif. L'import est statique, assumé pour éviter une requête de chunk à
l'ouverture du détail. Le vendor Dexie reste séparé et inchangé.

## Volume et complexité du code

| Élément | Lignes |
| --- | ---: |
| `site/app.js` avant / après | 5 765 → 5 921 (+156) |
| Composants `.jsx` du détail (7 fichiers) | 582 |
| `site/project-detail/controller-commands.js` | 369 |
| `site/project-detail/surface-decision.js` | 47 |
| Tests TS-059 (4 fichiers) | 920 |
| Harnais TS-059 | 181 |

Le rendu détail est découpé en `ProjectDetail`, `TaskList`, `TaskItem`,
`SubtaskList`, `TaskActionMenu` et `TaskEditor`, plus la surface et la décision
de route. Chaque composant est de taille raisonnable et réutilisable, notamment
`SubtaskList` et `TaskItem`.

Complexité observée :

- une seule racine React et un seul effet d'abonnement par surface ;
- 24 commandes nommées routées vers le contrôleur, dont la suppression/annulation
  et le glisser-déposer réutilisent les fonctions vanilla ;
- une seule source de règles métier (`site/core.js`) et un seul flux
  `persist()` ; aucune seconde base, aucun second store, ni Redux ;
- les composants n'importent ni Dexie, ni l'OTP, ni `site/app.js`, ni
  `persistence.js` ;
- le rendu vanilla d'Overview, des cartes de projets et de la carte de
  suggestion est conservé intégralement.

## Couverture des tests ciblés

Rapport complet : `/tmp/ts-059-coverage.json`.

| Fichier | Lignes | Branches | Fonctions |
| --- | ---: | ---: | ---: |
| `site/project-detail/controller-commands.js` | 91,06 % | 65,56 % | 73,17 % |
| `site/project-detail/surface-decision.js` | 91,49 % | 87,50 % | 100 % |
| `site/react-adapter.js` | 91,84 % | 71,83 % | 88,24 % |
| `site/react-boundary.js` | 82,96 % | 57,14 % | 76,92 % |
| Harnais TS-059 | 96,13 % | 95,83 % | 77,78 % |
| **Tous fichiers** | **82,59 %** | **72,56 %** | **71,48 %** |

Les composants `.jsx` sont compilés par esbuild dans un bundle temporaire ; Node
ne les attribue pas séparément dans ce rapport. Leurs assertions de rendu,
d'interaction et de continuité sont exécutées par les tests TS-059 et passent
(21 tests ciblés, 0 échec lors de la mesure).

## Interactions et preuves automatisées

Couvertes par des tests déterministes sur données synthétiques :

- rendu du titre, des compteurs, de l'ordre par priorité, de la hiérarchie, des
  IDs, des notes multilignes, des classes et de l'état vide ;
- markup utilisateur affiché littéralement, sans nœud exécutable ;
- création de tâche et de sous-tâche, édition avec préremplissage, sauvegarde,
  annulation et erreurs, complétion, priorité, menu et commandes désactivées ;
- suppression/annulation déléguée, promotion, réordonnancement, suivi et retour ;
- brouillon conservé après rafraîchissement, parents développés conservés,
  filtre des tâches terminées, focus sur un contrôle connecté ;
- liste longue, clés stables, absence de hauteur artificielle et retrait borné ;
- unicité de propriétaire DOM sur plusieurs cycles, invalidation de route et de
  projet, aucun contenu résiduel ;
- absence d'écriture Dexie/IndexedDB, de requête `fetch`/WebSocket ou de
  `localStorage` au montage, au rafraîchissement, au changement de présentation
  et au démontage.

Les scénarios de double callback, de validation et de non-écriture sont
également couverts par les tests de commandes et d'intégration.

## Risques d'intégration

- **Poids du bundle** : +246 227 octets sur le chunk applicatif. Acceptable pour
  un pilote, à réévaluer avant toute généralisation.
- **Continuité réelle** : `flushSync`, clés stables et helpers existants
  couvrent le comportement déterministe, mais le scroll et le clavier virtuel
  Android restent à vérifier physiquement.
- **Tactile et lecteur d'écran** : non prouvés par jsdom ; recette manuelle
  obligatoire.
- **Couplage au contrôleur** : les commandes dépendent de fonctions existantes
  de `site/app.js` (suppression, drag, persistance). Toute évolution de ces
  fonctions doit conserver les signatures injectées.

## Limites de vérification

Les tests automatiques ne remplacent pas :

- la comparaison visuelle desktop avec la référence Vite ;
- Chrome Android téléphone et tablette, portrait et paysage, clavier virtuel,
  cibles tactiles et glisser-déposer réel ;
- le parcours clavier physique Tab/Entrée/Espace/Échap avec focus visible ;
- un lecteur d'écran ;
- un second onglet et une actualisation Dexie Cloud de test ;
- un changement de compte, d'espace ou de cache bloqué ;
- l'export/import/restauration sur données de test.

Ces vérifications restent **non effectuées par la CI** et doivent être réalisées
avec des données de test et une sauvegarde préalable. Une CI verte ou un
déploiement réussi ne suffit pas à approuver une migration générale.

## Conclusion

**GO** pour conserver le pilote React limité au détail projet : la parité
fonctionnelle déterministe est couverte, la propriété DOM est exclusive, les
écritures restent uniques et les vues existantes demeurent vanilla. La décision
reste une recommandation de pilote ; elle ne déclenche, ne planifie et
n'autorise aucune migration automatique des autres vues, aucune fusion et aucun
déploiement supplémentaire. La recette manuelle ci-dessus conditionne toute
suite.
