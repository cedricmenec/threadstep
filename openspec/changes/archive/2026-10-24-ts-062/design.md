# Design

## Context

Voir `proposal.md` — Why. Le dépôt contient déjà les contrats canoniques qui
doivent primer sur Stitch : `app-navigation` pour les quatre destinations,
`subject-overview-preview` pour le quota de cinq tâches parentes,
`overview-project-metrics`, `next-action-suggestion`, `task-hierarchy-presentation`,
`action-note`, `resume-tracking`, `action-removal`, `cloud-opt-in-activation`,
`email-otp-authentication`, `cloud-sync-lifecycle`,
`workspace-identity-isolation` et `data-backup-import-restore`. Le code livré
reste la référence d'implémentation, mais la tâche est documentaire.

Le backlog TS-062 ne fournit que l'URL du projet Stitch et des identifiants
M01–M32. Il ne fournit ni session autorisée, ni liens profonds, ni identifiants
des quatre écrans desktop. Le runner d'`apply` peut donc ne pas pouvoir observer
les maquettes. Le design doit rendre cet état explicite sans transformer une
absence de preuve en validation.

Aucune surface applicative, aucun focus, aucun défilement, aucun groupe développé
et aucun état transitoire ne sont modifiés : le changement n'ajoute que de la
documentation et des artefacts OpenSpec.

## Goals / Non-Goals

**Goals:**

- Un catalogue unique, stable et versionné dans `docs/product/` qui répond à
  « quelles références existent, dans quel état de revue, pour quelle règle et
  avec quelle décision attendue ? ».
- Une nomenclature contrôlée des statuts et des dispositions, lisible par un
  humain et vérifiable par des assertions Node déterministes.
- Une matrice qui sépare explicitement style, structure, interaction et nouvelle
  fonctionnalité, et qui ne peut pas approuver implicitement une fonctionnalité.
- Une couverture traçable de toutes les règles produit citées par TS-062.
- Une porte TS-063 explicite, fermée jusqu'à validation humaine, avec candidats
  et points bloquants.
- Une distinction nette entre génération Stitch, inspection humaine, contrôle
  automatisé de documentation et preuve sur appareil réel.

**Non-Goals:**

- Corriger Stitch, signer une maquette ou contacter un service externe.
- Ajouter un test permanent, un script versionné, une dépendance ou un contrôle
  CI qui modifierait le périmètre « documentation seulement ».
- Décider à la place du propriétaire sur une divergence produit.
- Recopier les spécifications canoniques entières dans le catalogue.

## Decisions

### 1. Un seul catalogue versionné, avec identifiants stables

Créer `docs/product/stitch-reference-catalog.md` comme source documentaire
unique. Il contient : objet et sources, hiérarchie des preuves, inventaire,
matrice, registre des idées non autorisées, observations responsive et
accessibilité, bilan de validation humaine, porte TS-063 et journal des limites.

Les références mobiles utilisent les identifiants fournis `M01` à `M32`. Les
quatre écrans desktop reçoivent des identifiants **locaux** `DESKTOP-1` à
`DESKTOP-4`, avec une mention explicite qu'il ne s'agit pas d'identifiants
Stitch. Si une session autorisée révèle les vrais noms, ils sont ajoutés à côté
sans remplacer l'identifiant stable.

*Alternative rejetée :* plusieurs fichiers par écran. Cela multiplierait les
liens, rendrait la couverture difficile à prouver et compliquerait la relecture
du propriétaire.

### 2. Hiérarchie des sources en quatre niveaux

Le catalogue applique l'ordre suivant :

1. spécifications canoniques `openspec/specs/` ;
2. code livré et contrats de sécurité effectifs ;
3. décisions produit explicites du propriétaire, datées et limitées ;
4. références Stitch, uniquement comme propositions visuelles.

Une ligne de la matrice ne peut citer qu'une règle existante ou une décision
explicite. Une maquette seule n'est jamais une source d'autorité.

*Alternative rejetée :* traiter Stitch comme un cahier des charges visuel
prioritaire. Cela inverserait la source de vérité et exposerait les règles
métier à des propositions non approuvées.

### 3. Statuts de référence et dispositions de matrice séparés

Chaque référence reçoit un statut de revue :

- `NOT_REVIEWED` : non inspectée ou inaccessible ; jamais approuvée.
- `PARTIALLY_REVIEWED` : certains états seulement observés ; les états manquants
  sont listés.
- `REVIEWED_KEEP` : inspectée et utilisable sans correction observée.
- `REVIEWED_CORRECT_IN_STITCH` : inspectée ; une correction de la référence est
  proposée, sous réserve d'accès et de périmètre.
- `PRODUCT_DECISION_REQUIRED` : inspectée ; une décision propriétaire est
  nécessaire.
- `REJECTED` : inspectée et écartée.

Chaque écart de la matrice reçoit une disposition :

- `KEEP` (conserver) ;
- `CORRECT_IN_STITCH` (corriger dans Stitch) ;
- `PRODUCT_DECISION` (décision produit distincte) ;
- `REJECT` (rejeter).

Une référence peut avoir plusieurs lignes de disposition. Le statut de revue
reste distinct de la disposition pour éviter de qualifier toute une référence à
partir d'un seul détail.

*Alternative rejetée :* un statut unique « approuvé » par écran. Il masquerait
les divergences partielles et donnerait une fausse garantie sur les états non
observés.

### 4. Matrice à colonnes fixes et classification obligatoire

La matrice utilise les colonnes : `ID`, `Origine`, `Écran / état`, `Différence
observable`, `Catégorie`, `Disposition`, `Risque`, `Propriétaire`, `Règle ou
décision`, `Référence`. Les catégories autorisées sont `STYLE`, `STRUCTURE`,
`INTERACTION`, `NEW_FEATURE`. Le propriétaire d'une décision produit est toujours
l'utilisateur/propriétaire, jamais l'agent.

Une ligne `NEW_FEATURE` exige une décision produit explicite et ne peut pas être
autorisée par une ligne `STYLE`, `STRUCTURE` ou `INTERACTION`. Une différence
dont la catégorie est ambiguë est classée `PRODUCT_DECISION` avec une question
précise, plutôt que devinée.

*Alternative rejetée :* une simple liste de remarques. Les colonnes fixes
rendent les écarts comparables et les oublis détectables.

### 5. Couverture des règles par un socle de référence, pas par recopie

Le catalogue consigne pour chaque règle une ligne de référence courte avec le
chemin de spécification et le comportement observable concerné :

- quatre destinations et leurs routes/libellés (`app-navigation`) ;
- aperçu de cinq tâches parentes (`subject-overview-preview`) ;
- compteurs et progression (`overview-project-metrics`) ;
- suggestion déterministe (`next-action-suggestion`) ;
- hiérarchie à un niveau et priorités des sous-tâches
  (`task-hierarchy-presentation`) ;
- notes en texte brut (`action-note`) ;
- reprise (`resume-tracking`) ;
- Undo de retrait (`action-removal`) ;
- consentement, authentification, synchronisation et restauration
  (`cloud-opt-in-activation`, `email-otp-authentication`,
  `cloud-sync-lifecycle`, `workspace-identity-isolation`,
  `data-backup-import-restore`).

Le catalogue ne recopie pas les scénarios canoniques : il pointe vers eux et
décrit seulement la conséquence pour la revue Stitch. Les écarts fonctionnels
observés renvoient à ces lignes ou à une décision produit identifiée.

*Alternative rejetée :* réécrire les règles dans le catalogue. Cela créerait
une seconde source de vérité et un risque de divergence.

### 6. Registre séparé des idées non autorisées

Une section dédiée liste recherche, archives, partage, Markdown, raccourcis et
statistiques. Chaque idée est explicitement marquée comme non autorisée par le
contrat actuel, avec la mention qu'une nouvelle tâche et l'accord du
propriétaire sont requis. Ces idées ne peuvent jamais être présentées comme des
« corrections de style » ou des « améliorations d'interaction ».

*Alternative rejetée :* les disperser dans la matrice. Une section dédiée les
rend visibles et empêche leur adoption implicite.

### 7. Observations responsive et accessibilité séparées de la preuve

Le catalogue décrit les variantes à 320, 390, 430 et 768 px, les composants
réutilisables proposés et les points à vérifier : contrastes, tailles de cible,
focus, textes, débordement et lisibilité. Chaque point porte un statut
`À VÉRIFIER` tant qu'une recette réelle n'a pas eu lieu.

M32 est présentée comme une planche de composants candidate. Le catalogue
indique explicitement qu'elle ne certifie ni contraste, ni focus, ni cible
tactile, ni lecteur d'écran.

*Alternative rejetée :* qualifier les variantes Stitch de « responsive validé ».
Aucune maquette n'est un essai sur appareil.

### 8. Porte TS-063 fondée sur une décision humaine consignée

Le catalogue contient une section « Sous-ensemble navigation pour TS-063 » avec
deux états possibles : `CANDIDATES_LISTED` ou `BLOCKED_PENDING_USER_VALIDATION`.
Il peut aussi porter `APPROVED_BY_OWNER` uniquement après une validation humaine
explicite, avec date, portée et références approuvées.

Sans validation, la section liste les références candidates du header, du menu
et des quatre destinations, ainsi que les points bloquants et la décision
attendue. Elle ne déclare ni « prêt pour TS-063 », ni autorisation
d'implémentation. Une validation partielle ne lève que les références
explicitement approuvées.

*Alternative rejetée :* déduire un sous-ensemble validé à partir de la qualité
apparente des maquettes. Cela contournerait l'arbitrage propriétaire exigé par
la tâche.

### 9. Validation documentaire déterministe sans nouveau test permanent

Pendant `apply`, un script Node temporaire sous `/tmp/` (non versionné) lit le
catalogue et vérifie :

- présence unique de `M01` à `M32` et de `DESKTOP-1` à `DESKTOP-4` ;
- statut et lien non vides pour chaque référence ;
- aucune référence `NOT_REVIEWED` marquée approuvée ;
- présence des colonnes et valeurs contrôlées de la matrice ;
- présence des règles produit et des idées non autorisées ;
- présence des largeurs 320/390/430/768 px et de la mention M32 non
  certificative ;
- présence de la section TS-063 et d'un état non ambigu ;
- absence de modification hors documentation/OpenSpec, vérifiée par
  `git status`/`git diff`.

`npm run check` et `openspec validate ts-062 --strict --no-interactive`
complètent la preuve. Aucun fichier sous `tests/` n'est créé ou modifié.

*Alternative rejetée :* ajouter un test permanent. Il serait plus maintenable,
mais contredirait la contrainte explicite d'absence de modification de code pour
cette tâche documentaire. Un test permanent pourra être décidé séparément.

### 10. Aucune correction Stitch appliquée par défaut

Le catalogue peut formuler des consignes de correction précises, mais ne modifie
aucune maquette. Toute correction externe exige un accès autorisé, un périmètre
validé et une action distincte. Les maquettes signées-off restent intactes.

*Alternative rejetée :* corriger Stitch pendant l'audit. Cela élargirait le
périmètre à un service externe, avec un risque de perte de référence et sans
autorisation explicite.

## Risks / Trade-offs

- **Absence d'accès Stitch sur le runner** → Le catalogue reste honnête avec
  `NOT_REVIEWED` et des liens au niveau du projet. Le propriétaire devra fournir
  une session ou des liens profonds pour compléter la revue ; aucune validation
  n'est simulée.
- **Identifiants desktop locaux confondus avec des identifiants Stitch** →
  `DESKTOP-1` à `DESKTOP-4` sont explicitement déclarés comme convention de
  catalogue ; les vrais noms, s'ils existent, sont ajoutés sans ambiguïté.
- **Catalogue qui dérive des spécifications** → Chaque règle est référencée par
  chemin ; une modification canonique future doit mettre à jour le catalogue
  dans la même livraison.
- **Matrice trop volumineuse** → Une ligne par écart observable, colonnes
  courtes, regroupement par référence et renvoi aux specs pour le détail.
- **Fausse impression d'approbation** → Statuts explicites, registre des
  références non examinées, et contrôle automatisé interdisant l'approbation
  d'une référence `NOT_REVIEWED`.
- **Le contrôle temporaire n'est pas rejoué en CI** → `npm run check` protège
  l'absence de régression, tandis que la complétude du catalogue est prouvée
  pendant `apply` et consignée dans le rapport. Un test permanent reste une
  décision séparée.
- **Décision TS-063 prise trop tôt** → La porte reste
  `BLOCKED_PENDING_USER_VALIDATION` tant que la validation humaine n'est pas
  consignée, même si tous les contrôles automatiques passent.

## Migration Plan

1. Rédiger le catalogue avec ses sections, statuts, matrice, registre,
   observations responsive et porte TS-063.
2. Exécuter les assertions Node temporaires de complétude et de cohérence ;
   corriger le catalogue jusqu'au succès.
3. Exécuter `npm run check` et `openspec validate ts-062 --strict
   --no-interactive`.
4. Vérifier par `git status`/`git diff` qu'aucun code produit, test, workflow,
   backlog, configuration ou secret n'a changé.
5. Laisser la validation humaine et la levée éventuelle de la porte TS-063 hors
   de l'`apply`, dans `Manual acceptance`.

Aucun rollback de données n'est nécessaire : la livraison est documentaire et
n'écrit ni IndexedDB, ni localStorage, ni configuration Cloud.

## Open Questions

Aucune question bloquante pour le plan. Les résultats de revue (références
inspectées, décisions produit, approbation du sous-ensemble navigation) sont des
entrées humaines attendues, consignées dans le catalogue, et ne changent ni les
spécifications ni la décomposition des tâches.
