# Qualification du pilote React — détail projet (TS-060)

**Date de qualification :** 24 octobre 2026
**Branche proposée :** état de travail au-dessus de `main` au SHA
`7c7ec0da994bdeea0ef57dd6b8db0979b62411f7`.
**Périmètre :** route `#/sujet/<id>` uniquement. Overview, Paramètres,
Synchronisation et navigation restent vanilla.
**Décision :** **NO-GO** pour ouvrir le lot suivant tant que la recette
physique listée ci-dessous n'a pas produit de preuves `PASS`. Ce NO-GO est
borné au lot suivant ; il ne remet pas en cause le pilote livré, ne déclenche
aucune migration et n'autorise ni fusion ni publication supplémentaire.

## Portée et état de build

Le pilote React reste limité à une seule surface métier. TS-060 ajoute des
tests déterministes et de la documentation, plus une seule correction bornée
dans `site/project-detail/controller-commands.js` (voir « Corrections
démontrées »). Aucune route, aucun identifiant, aucune règle métier de
`site/core.js` et aucun flux de persistance n'ont été modifiés. La qualification
compare l'état de build à celui du bilan TS-059
(`docs/product/react-project-detail-pilot.md`) mesuré le 24 octobre 2026.

Commandes réellement exécutées pendant `apply` :

```sh
node --test tests/ts-059-project-detail-render.test.mjs \
  tests/ts-059-project-detail-commands.test.mjs \
  tests/ts-059-project-detail-integration.test.mjs \
  tests/ts-059-project-detail-continuity.test.mjs
node --test tests/ts-060-project-detail-commands.test.mjs \
  tests/ts-060-project-detail-lifecycle.test.mjs \
  tests/ts-060-project-detail-transitions.test.mjs \
  tests/ts-060-project-detail-continuity.test.mjs \
  tests/ts-060-overview-read-state.test.mjs \
  tests/ts-060-qualification-report.test.mjs
node --test --experimental-test-coverage tests/ts-060-*.test.mjs
npm run check
npm run build
npm run verify:build
openspec validate ts-060 --strict --no-interactive
node scripts/check-openspec-task-phases.mjs openspec/changes/ts-060/tasks.md
```

## Matrice de recette

Les statuts autorisés sont `PASS`, `FAIL` et `NOT_RUN`. Une ligne `PASS`
automatisée ne vaut pas essai matériel. Les lignes non exécutées restent
`NOT_RUN` et conditionnent l'acceptation humaine. Les données utilisées sont
synthétiques ; aucune donnée personnelle n'est purgée, réimportée ou
transférée.

| ID | Parcours | Environnement | Preuve ou commande | Statut | Date / appareil |
| --- | --- | --- | --- | --- | --- |
| Q01 | Création d'une tâche et d'une sous-tâche | Automatisé (Node/jsdom) | `tests/ts-060-project-detail-commands.test.mjs`, `tests/ts-060-project-detail-continuity.test.mjs` | PASS | 2026-10-24 / runner CI |
| Q02 | Édition, sauvegarde et annulation | Automatisé (Node/jsdom) | `tests/ts-060-project-detail-continuity.test.mjs` | PASS | 2026-10-24 / runner CI |
| Q03 | Priorités, ordre et relation parent/sous-tâche | Automatisé (Node) | `tests/ts-060-project-detail-commands.test.mjs` | PASS | 2026-10-24 / runner CI |
| Q04 | Notes brutes, titres et compteurs | Automatisé (Node) | `tests/ts-060-project-detail-commands.test.mjs` | PASS | 2026-10-24 / runner CI |
| Q05 | Filtre des tâches terminées et parents développés | Automatisé (Node/jsdom) | `tests/ts-060-project-detail-continuity.test.mjs` | PASS | 2026-10-24 / runner CI |
| Q06 | Menus, commandes désactivées et alternative clavier | Automatisé (Node/jsdom) | `tests/ts-060-project-detail-commands.test.mjs`, `tests/ts-060-project-detail-lifecycle.test.mjs` | PASS | 2026-10-24 / runner CI |
| Q07 | Retrait et Undo de dix secondes | Automatisé (Node) | `tests/ts-060-project-detail-commands.test.mjs` | PASS | 2026-10-24 / runner CI |
| Q08 | Glisser-déposer délégué sans écriture implicite | Automatisé (Node) | `tests/ts-060-project-detail-commands.test.mjs` | PASS | 2026-10-24 / runner CI |
| Q09 | Listes longues et ancrage de lecture | Automatisé (Node/jsdom) | `tests/ts-060-project-detail-continuity.test.mjs` | PASS | 2026-10-24 / runner CI |
| Q10 | Retour Overview, changement de projet et invalidation | Automatisé (Node/jsdom) | `tests/ts-060-project-detail-transitions.test.mjs` | PASS | 2026-10-24 / runner CI |
| Q11 | Identité, espace, lecture bloquée et projet disparu | Automatisé (Node/jsdom) | `tests/ts-060-project-detail-transitions.test.mjs` | PASS | 2026-10-24 / runner CI |
| Q12 | États Overview TS-052, loader 250 ms et attente 8 000 ms | Automatisé (Node) | `tests/ts-060-overview-read-state.test.mjs` | PASS | 2026-10-24 / runner CI |
| Q13 | Retour/avant navigateur et rechargement | Navigateur isolé | Non exécuté | NOT_RUN | — |
| Q14 | Rechargement avec brouillon et parent développé | Navigateur isolé | Non exécuté | NOT_RUN | — |
| Q15 | Chrome Android réel, clavier virtuel et scroll portrait/paysage | Android réel | Non exécuté | NOT_RUN | — |
| Q16 | Glisser-déposer tactile et cibles 44 × 44 px | Tactile | Non exécuté | NOT_RUN | — |
| Q17 | Parcours Tab/Entrée/Espace/Échap et focus visible | Clavier physique | Non exécuté | NOT_RUN | — |
| Q18 | Noms accessibles, `aria-expanded` et annonces | Lecteur d'écran | Non exécuté | NOT_RUN | — |
| Q19 | Second onglet/appareil, actualisation et changement de compte | Dexie Cloud de test | Non exécuté | NOT_RUN | — |
| Q20 | Comparaison visuelle desktop avec le rendu vanilla | Navigateur isolé | Non exécuté | NOT_RUN | — |

## Mesures avant/après

Mesures prises avec `npm run build`, puis lecture de `dist/assets`, du chunk
`app-*.js` et du CSS, aux deux moments de la qualification (avant puis après
les tests et la documentation, sans modification de production).

| Mesure | Avant | Après | Écart |
| --- | ---: | ---: | ---: |
| Total `dist/assets` | 936 456 octets | 936 490 octets | +34 octets |
| Chunk applicatif `app-*.js` | 558 172 octets | 558 206 octets | +34 octets |
| CSS | 36 285 octets | 36 285 octets | 0 octet |

L'écart de +34 octets provient uniquement de la correction bornée de
`updateItem` dans `site/project-detail/controller-commands.js`. Les valeurs sont
conservées dans `/tmp/ts-060-build-baseline.json` et
`/tmp/ts-060-build-after.json` pour cette exécution.

Couverture observée par `node --test --experimental-test-coverage
tests/ts-060-*.test.mjs`, conservée dans `/tmp/ts-060-coverage.json` :

| Fichier | Lignes | Branches | Fonctions |
| --- | ---: | ---: | ---: |
| `site/project-detail/controller-commands.js` | 99,19 % | 70,00 % | 80,49 % |
| `site/project-detail/surface-decision.js` | 100 % | 100 % | 100 % |
| `site/react-adapter.js` | 91,02 % | 70,77 % | 88,24 % |
| `site/react-boundary.js` | 77,78 % | 56,00 % | 76,92 % |
| `site/overview-read-state.js` | 93,84 % | 86,05 % | 75,00 % |
| Harnais jsdom TS-059 | 90,06 % | 95,83 % | 82,35 % |

Les tests déterministes TS-060 comptent 6 fichiers et 33 tests réussis, 0 échec,
lors de la dernière exécution ciblée.

## Comparaison avec le bilan TS-059

| Élément | TS-059 | TS-060 |
| --- | --- | --- |
| Surface React | `#/sujet/<id>` uniquement | Inchangée |
| Total `dist/assets` | 936 456 octets | 936 490 octets (+34) |
| Chunk applicatif | 558 172 octets | 558 206 octets (+34) |
| CSS | 36 285 octets | 36 285 octets (inchangé) |
| `site/app.js` | 5 921 lignes après TS-059 | 5 923 lignes, inchangé par TS-060 |
| Tests React ciblés | 21 tests TS-059 | 21 tests TS-059 + 27 tests TS-060 |
| Continuité brouillon/parent/focus | Couverture partielle | Couverture élargie et invalidation multi-contexte |
| Android, tactile, clavier, lecteur d'écran | Non exécuté | Toujours `NOT_RUN` |
| Dexie Cloud de test | Non exécuté | Toujours `NOT_RUN` |

TS-060 confirme les invariants déterministes du pilote, corrige une commande
d'édition sans note et étend la preuve aux commandes uniques, aux transitions
d'identité/espace, à la lecture bloquée, au projet disparu, aux contrats
Overview et au retrait/Undo. Il ne comble pas les lacunes matérielles du bilan
TS-059.

## Corrections démontrées

Un seul défaut reproductible a été démontré dans la frontière React, dans
`site/project-detail/controller-commands.js` : `updateItem` transmettait
toujours une clé `note` au moteur, y compris `undefined` lorsque la tâche
n'avait aucune note. `site/core.js` refuse alors la mutation (`hasNote` vrai,
type non chaîne), donc une édition de titre ou de priorité sans note était
silencieusement perdue hors du formulaire React complet. Le correctif omet la
clé `note` quand elle reste indéfinie et conserve la note brute lorsqu'elle
existe. Le test de non-régression est
`TS-060 the adapter stays read-only and every business write keeps the injected
persist path`.

Aucune autre régression n'a été démontrée dans `site/project-detail/*`,
`site/react-adapter.js` ou `site/react-boundary.js`. Un défaut hors de cette
frontière resterait orienté vers une tâche de fiabilité distincte, sans
extension opportuniste du périmètre.

## Tests automatisés effectivement réussis

- commande unique, absence de double callback et au plus une écriture par
  intention valide ;
- validations existantes sans écriture sur titre, note, priorité, parent et
  limite d'étapes ;
- priorité, ordre, hiérarchie, notes brutes, titres, compteurs et suivi ;
- retrait/annulation avec restauration exacte du sous-arbre et du suivi ;
- constante `UNDO_WINDOW_MS = 10000` et timer annulable ;
- cycle de vie complet sans écriture IndexedDB, `fetch`, WebSocket ou
  `localStorage` et sans commande métier ;
- invalidation sur route, projet, identité, espace, lecture bloquée et projet
  disparu, avec une seule racine et sans contenu résiduel ;
- brouillon, parents développés, focus connecté et intention de clavier virtuel
  après commit ;
- liste longue, clé stable, voisin d'ancrage et absence de hauteur artificielle ;
- seuils Overview 250 ms/8 000 ms, absence de faux état vide et stabilité des
  projets disponibles ;
- branchement Overview sans surface React métier.

## Limites et scénarios physiques non exécutés

Les lignes Q13 à Q20 restent `NOT_RUN`. La CI ne remplace pas :

- un navigateur isolé pour le retour/avant, le rechargement et la comparaison
  visuelle ;
- Chrome Android téléphone et tablette, portrait et paysage, clavier virtuel,
  cibles tactiles et glisser-déposer réel ;
- un parcours clavier physique complet avec focus visible ;
- un lecteur d'écran ;
- une instance Dexie Cloud de test, un second onglet ou appareil et un
  changement de compte/espace autorisé.

Ces essais exigent des données de test, une sauvegarde préalable et aucune purge
de données personnelles. Ils restent requis pour l'acceptation humaine et ne
sont ni cochés ni présentés comme validés.

## Recommandation et décision

**NO-GO borné pour le lot suivant.** Les preuves automatisées sont vertes et le
pilote reste techniquement cohérent, mais aucune preuve physique Android,
tactile, clavier, lecteur d'écran ou Dexie Cloud de test n'a été produite. La
CI verte ne constitue pas un GO global et ne remplace pas la recette humaine.

La poursuite vers TS-061 ou TS-063 nécessite d'abord l'exécution de la recette
physique de `tasks.md` (`Manual acceptance`), avec un statut `PASS` documenté
pour chaque scénario applicable, puis une décision humaine explicite sur ce
bilan. TS-060 ne déclenche, ne planifie et n'autorise aucune autre migration,
fusion ou publication.
