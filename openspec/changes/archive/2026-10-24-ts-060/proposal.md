# Proposal

## Why

TS-058 et TS-059 ont livré une surface React limitée à `#/sujet/<id>`, avec un
GO technique qui ne couvre ni Chrome Android réel, ni clavier physique, ni
tactile, ni lecteur d'écran, ni actualisation Dexie Cloud de test. Avant
d'envisager une autre surface, TS-060 doit qualifier et durcir ce pilote de
façon bornée : prouver les invariants de continuité, d'invalidation et
d'écriture unique sur données synthétiques, produire une matrice de recette
honnête et consigner une décision de poursuite sans transformer une CI verte en
GO global.

## What Changes

- Formaliser une **matrice de recette reproductible** du détail projet React
  couvrant création, édition/annulation, sous-tâches, filtres, priorités, menus,
  glisser-déposer et alternative clavier, retrait/Undo, listes longues,
  retour/avant, rechargement, lecteur d'écran et Dexie Cloud de test.
- Compléter les **tests déterministes et d'intégration** sur données
  synthétiques pour les chemins encore non prouvés : un seul callback et une
  seule commande, aucune mutation au montage/démontage, brouillon et parent
  développé conservés, focus/ancrage de lecture, identité/espace changés,
  projet disparu, lecture bloquée, rafraîchissements inter-onglets et absence
  de contenu de l'ancienne identité.
- Vérifier les **contrats Overview TS-052** (loader après 250 ms, attente
  durable après 8 000 ms, pas de flash de diagnostic, pas de faux état vide)
  sans refondre Overview ni le moteur Dexie.
- Corriger **uniquement les régressions démontrées dans la frontière React ou
  ses commandes**. L'adaptateur reste en lecture seule, `site/core.js` reste la
  source des règles et des identifiants, et chaque intention métier garde une
  seule écriture via le flux existant.
- Produire une **matrice de qualification versionnée** et un **bilan comparé au
  pilote TS-059** : preuves automatisées réellement passées, scénarios physiques
  `PASS`, `FAIL` ou `NOT_RUN`, limites, mesures de bundle et recommandation
  explicite GO/NO-GO pour le lot suivant. Aucun scénario non exécuté ne sera
  présenté comme réussi.
- Mettre à jour la documentation développeur et l'architecture pour décrire la
  qualification, les commandes de mesure et la séparation entre preuve CI et
  recette humaine.

## Capabilities

### New Capabilities

- `react-project-detail-qualification` : contrat de qualification bornée du
  pilote — matrice reproductible avec statuts de preuve honnêtes, tests
  synthétiques des invariants de continuité et d'invalidation, préservation des
  états Overview, absence d'écriture ou de requête implicite, limites de build
  et décision GO/NO-GO comparée à TS-059, sans autorisation automatique du lot
  suivant.

### Modified Capabilities

Aucune exigence canonique existante n'est réécrite. `react-project-detail-pilot`,
`react-integration-boundary`, `ux-interaction-continuity`,
`overview-project-read-state`, `subject-detail-view`, `task-hierarchy-presentation`,
`task-actions-menu`, `action-editing`, `action-removal`, `app-navigation` et
`workspace-identity-isolation` restent les sources de vérité ; TS-060 les
applique et les prouve sans en modifier le comportement attendu.

## Impact

- `tests/` : nouveaux fichiers déterministes TS-060 pour les commandes, le
  montage/démontage, les transitions de route/projet/identité, la continuité
  brouillon/parent/focus/scroll/liste longue, l'Undo de 10 s, les contrats
  Overview TS-052 et la structure de la matrice/bilan. Réutilisation du harnais
  jsdom TS-059 et des données synthétiques existantes.
- `docs/product/react-project-detail-qualification.md` : matrice de recette et
  bilan versionnés, avec environnements, commandes, statuts, limites et
  recommandation.
- `docs/product/developer-guide.md` et `docs/architecture.md` : description de
  la qualification, des commandes de vérification, des frontières et de la
  décision humaine.
- `site/project-detail/*.jsx`, `site/project-detail/controller-commands.js`,
  `site/react-adapter.js` ou `site/react-boundary.js` : uniquement si un test
  TS-060 démontre une régression bornée à cette frontière. Aucun changement de
  règle métier, de style, de route, de donnée ou de synchronisation.
- Aucun changement de `site/core.js`, `site/app.js` hors correction React
  démontrée, `site/index.html`, CSP, identifiants IndexedDB, configuration
  Cloud/OTP, format JSON, backlog, `AGENTS.md`, workflows, secrets ou fichiers
  factory protégés.

## Focus, scroll et états transitoires

Invariants qualifiés pendant une action ou un rafraîchissement autorisé dans la
même vue et la même identité :

- le brouillon d'éditeur encore applicable reste présent après un render, un
  filtre ou un rafraîchissement inter-onglets/Dexie simulé ;
- un parent développé reste développé tant que des sous-tâches visibles
  subsistent ; les autres parents gardent leur état ;
- le focus reste sur un contrôle connecté ou rejoint un repère pertinent ; il
  ne reste jamais sur un nœud détaché ;
- l'ancrage de lecture est conservé lors d'une création, d'une coche ou d'un
  réordonnancement, et aucune hauteur artificielle ne persiste après le rendu ;
- les intentions de focus liées au clavier virtuel restent appliquées après le
  commit React, sans écriture métier ;
- menus, éditeurs et préférences de présentation ne persistent rien.

Exceptions déjà canoniques, qualifiées comme des transitions : navigation
explicite, Précédent/Suivant, retour Overview, rechargement/nouvel onglet,
import réussi, changement d'identité/espace autorisé, lecture bloquante ou
projet disparu. Dans ces cas, la racine React est invalidée avant tout retour
au rendu vanilla et aucun contenu de l'ancien contexte ne reste visible.

## Non-goals

- Migrer Overview, la navigation, Paramètres, Imports / Exports, la
  Synchronisation, Dexie ou l'OTP ; refondre le design, Tailwind, Stitch ou un
  design system.
- Changer les règles métier, les limites, les identifiants, le format de
  données, l'export/import/restauration ou la synchronisation Cloud.
- Introduire un second store, Redux, un routeur React, une nouvelle base, une
  nouvelle clé de stockage ou une ressource réseau implicite.
- Corriger un défaut de synchronisation, d'identité ou de migration hors de la
  frontière React : un tel défaut sera documenté et orienté vers une tâche
  distincte du backlog de fiabilité Dexie.
- Inventer ou extrapoler les résultats Chrome Android, clavier physique,
  tactile, lecteur d'écran ou Dexie Cloud de test.
- Déclencher, planifier ou autoriser automatiquement TS-061, TS-063 ou toute
  migration d'une autre vue.
- Modifier les workflows, secrets, permissions, protections ou fichiers
  factory protégés.

## Assumptions and uncertainties

- TS-059 est livrée sur `main` au SHA `bde2e5d62cfb415c82f3e19131dcfbd77e566927`
  avec CI et Pages vertes. Le GO technique de son bilan ne vaut pas GO de
  généralisation et ne dispense pas de cette qualification.
- Aucune régression précise n'est connue avant `apply`. Les tâches prévoient un
  audit par tests ; une correction n'est admise que si un test TS-060 échoue de
  façon reproductible dans la frontière React ou ses commandes. Si aucun test
  n'échoue, le bilan doit l'indiquer explicitement plutôt que fabriquer une
  correction.
- La recette Android, tactile, clavier réel, lecteur d'écran et Dexie Cloud de
  test dépend du propriétaire et d'appareils/instance de test. Elle reste
  `NOT_RUN` tant qu'aucune preuve datée n'est fournie ; le plan ne prétend pas
  l'exécuter sur le runner GitHub Actions.
- La décision finale de poursuite est humaine. Le bilan peut recommander un GO
  conditionnel ou un NO-GO, mais il doit rester borné, comparer les résultats à
  TS-059 et distinguer la CI des essais physiques.
- Les valeurs de couverture, de poids de bundle et de nombre de tests après
  TS-060 ne sont pas connues avant `apply` et ne doivent pas être inventées.
  Le rapport les mesurera avec les commandes indiquées.
