# Proposal

## Why

TS-058 a livré et vérifié la frontière d'intégration React, l'adaptateur de
présentation et l'outillage de test, mais aucune surface métier réelle ne les
utilise encore. TS-059 doit valider ce socle sur une tranche représentative
— le détail d'un projet `#/sujet/:id` — afin de savoir si des composants React
réutilisables simplifient réellement le code sans changer l'interface, les
données, la persistance, la synchronisation ni la sécurité. Le pilote vise une
décision GO / NO-GO documentée, pas une migration générale.

## What Changes

- Remplacer **uniquement** le rendu de la vue détail d'un projet
  `#/sujet/:id` par une racine React qui possède exclusivement son sous-arbre
  DOM. Overview, Paramètres, Imports / Exports et Synchronisation restent
  rendus par le vanilla existant ; chaque transition de route démonte ou
  invalide proprement la racine précédente.
- Extraire des composants de présentation réutilisables de taille raisonnable :
  `ProjectDetail`, `TaskList`, `TaskItem`, `SubtaskList`, `TaskActionMenu` et
  `TaskEditor`. Conserver les classes CSS, libellés français, noms accessibles,
  ordre de lecture, compteurs et hiérarchie de la référence Vite actuelle.
- Brancher toutes les interactions sur l'adaptateur TS-058 et les commandes du
  contrôleur existant : création de tâche et de sous-tâche, édition
  titre/note/priorité, complétion, suppression et annulation, changement de
  priorité, réordonnancement, promotion, ouverture/repli des sous-tâches,
  menu (dont « Garder le fil ») et retour à Overview. Aucune mutation n'est
  dupliquée dans React et aucune limite métier ne change.
- Préserver les IDs, hiérarchies, compteurs, filtre des tâches terminées,
  ordre par priorité, états vides, validations, messages et erreurs.
- Traiter explicitement les états éphémères : brouillon d'éditeur, menu ouvert,
  parents développés, focus, scroll, position de lecture et drag/tactile, y
  compris après une modification locale, un rafraîchissement inter-onglets,
  un événement Dexie ou un filtre. Aucun montage, rendu, abonnement ou
  démontage ne déclenche d'écriture métier, de requête Cloud, d'OTP ou de
  migration.
- Ajouter des tests déterministes de composants et d'intégration sur données
  synthétiques : rendu, clavier, menus, édition/annulation, événements de
  rafraîchissement, changement de route/compte, suppression d'une tâche
  ancrée, liste longue et clamp de scroll, unicité de propriétaire DOM et
  absence de double callback/écriture.
- Consigner un **bilan de pilote** comparant code, couverture, taille de build,
  complexité et interactions, avec une recommandation explicite GO / NO-GO.
  Un GO ne crée ni tâche de migration globale ni autorisation de fusion ou de
  déploiement supplémentaire.

## Capabilities

### New Capabilities

- `react-project-detail-pilot` : contrat observable du premier pilote React
  sur le détail d'un projet — rendu React exclusif de cette route, parité de
  présentation et d'interactions, continuité des états éphémères, absence
  d'écriture implicite, invalidation aux frontières de contexte,
  compatibilité des données/URLs/build et bilan GO / NO-GO.

### Modified Capabilities

- `react-integration-boundary` : le requirement « Surface React dormante et
  interface existante inchangée » devient « Surface React activée uniquement
  sur le détail projet ». Le reste du socle (dépendances exactes, JSX local,
  propriété DOM, adaptateur, invalidation, tests, documentation, retour
  arrière) est conservé. Les capacités `subject-detail-view`,
  `task-hierarchy-presentation`, `task-actions-menu`, `action-editing`,
  `substep-collapse`, `ux-interaction-continuity`, `app-navigation`,
  `workspace-identity-isolation`, `frontend-security-boundary`,
  `static-build-pipeline` et les contrats de synchronisation gardent leurs
  exigences : ce changement les applique sans les réécrire.

## Impact

- `site/app.js` : branchement du détail projet vers la surface React, garde-fou
  de propriété DOM, invalidation, capture/restauration focus-scroll et
  commandes vers le contrôleur existant. Aucun changement du rendu Overview,
  Paramètres, Imports / Exports ou Synchronisation.
- Nouveaux modules de présentation React sous `site/` (composants du détail,
  surface de montage et décision de route), importés par `site/app.js`.
  `site/core.js` reste la source des règles et identifiants.
- `site/react-adapter.js` : commandes supplémentaires nécessaires aux
  interactions du détail (sous-tâche, priorité, édition, déplacement, annulation
  de retrait, focus) et instantané enrichi des données de présentation
  (filtre, suivi, état transitoire), sans second store ni règle métier dupliquée.
- `site/styles.css` uniquement si une classe existante doit être réutilisée ;
  aucun nouveau style, couleur, composant graphique ou refonte Stitch.
- `tests/` : nouvelle fixture/harnais React pour les composants de production,
  tests de rendu, d'interactions, de continuité, d'invalidation, d'absence
  d'écriture, de build et de documentation. Les assertions TS-058 qui décrivaient
  l'absence de toute surface sont ajustées pour la seule activation du détail ;
  leurs preuves de propriété DOM, d'adaptateur et de non-écriture restent
  vertes.
- `docs/product/developer-guide.md`, `docs/architecture.md` et un rapport de
  pilote versionné : composants, montage/démontage, état transitoire, limites,
  mesures avant/après et recommandation GO / NO-GO.
- Aucun changement de `.github/workflows/*`, `AGENTS.md`, secrets,
  permissions, identifiants IndexedDB, URL Cloud, format JSON, CSP, base de
  données ou routes publiques.

## Focus, scroll et états transitoires

Invariants conservés pendant une action ou un rafraîchissement dans la même
vue et la même identité autorisée :

- le brouillon d'éditeur encore applicable reste présent après un render ou un
  rafraîchissement de données ;
- les parents développés restent développés tant que des sous-tâches visibles
  subsistent ; les autres parents gardent leur état ;
- le focus reste sur un contrôle réellement présent, ou rejoint un repère
  pertinent si son contrôle a été supprimé ; il ne reste jamais sur un nœud
  détaché ;
- la position de lecture et le scroll sont préservés lors d'un remplacement ou
  d'un réordonnancement, y compris sur liste longue ; la réduction réelle due
  à un filtre ou une suppression reste permise ;
- le menu ouvert et l'éditeur sont des états de présentation qui ne persistent
  rien et ne déclenchent aucune écriture ;
- le glisser-déposer réutilise les restrictions existantes et ne devient pas
  la seule voie de réordonnancement.

Exceptions justifiées, déjà canoniques : une navigation explicite (route,
Précédent/Suivant, retour Overview), un rechargement ou nouvel onglet, un
import réussi, un changement d'identité/espace autorisé ou un état de
chargement bloquant réinitialisent ces états. Un rafraîchissement autorisé
(Dexie, inter-onglets) n'est pas une navigation.

## Non-goals

- Migrer Overview, la navigation, Paramètres, Imports / Exports, la
  restauration, la Synchronisation, l'OTP, Dexie Cloud ou la sauvegarde.
- Tailwind, design system, maquettes Stitch, nouvelle couleur, nouvelle
  disposition, nouvelle fonctionnalité métier ou nouvelle route.
- Introduire Redux, un routeur React, un second store métier, une seconde base
  ou une nouvelle clé de stockage.
- Réécrire `site/core.js`, la persistance Dexie, les contrats Cloud/OTP/
  consentement/backup/import/restauration ou le format JSON.
- Modifier les workflows, secrets, permissions, protections ou fichiers
  factory protégés.
- Décider ou déclencher automatiquement la migration des autres vues à partir
  du bilan.

## Assumptions and uncertainties

- TS-058 est considérée livrée et vérifiée : `react@19.3.1`,
  `react-dom@19.3.1`, `jsdom@30.1.3`, `site/react-boundary.js`,
  `site/react-adapter.js`, la fixture et les tests associés sont présents et
  la spec canonique `react-integration-boundary` est archivée. Si l'exclusivité
  DOM ou les tests de non-régression ne peuvent pas être garantis pendant
  `apply`, le travail doit s'arrêter au plan plutôt que remplacer toute
  l'application.
- Le montage dans `#subjects` plutôt que dans un conteneur enfant est une
  décision technique à confirmer en design ; elle doit préserver une racine
  unique et empêcher toute écriture vanilla dans son sous-arbre.
- La répartition exacte entre état de présentation porté par le contrôleur et
  état local React est une décision de design. Le contrat exige la même
  continuité et les mêmes réinitialisations, pas une répartition donnée.
- Les noms exacts des composants et fichiers restent ajustables tant que le
  découpage demandé (`ProjectDetail`, `TaskList`, `TaskItem`, `SubtaskList`,
  `TaskActionMenu`, `TaskEditor`) est respecté.
- Les mesures de volume, complexité, couverture et taille de build, ainsi que
  la conclusion GO / NO-GO, ne sont pas connues avant `apply` et ne doivent pas
  être inventées dans ce plan.
- La spec canonique `static-build-pipeline` peut encore contenir une formulation
  historique sur la publication alors que Pages sert `dist/`. TS-059 ne la
  réécrit pas, ne touche à aucun workflow et ne modifie pas la CSP ; ce point
  reste une vérification de revue post-sync, sans effet sur le pilote.
- Aucune recette visuelle, mobile, tactile, clavier réelle ou lecteur d'écran
  n'est prouvée par ce plan ni par la CI. La fiche TS-059 est
  `automation: manual` et `risk: high` ; ce plan n'autorise ni workflow payant,
  ni fusion, ni déploiement.
