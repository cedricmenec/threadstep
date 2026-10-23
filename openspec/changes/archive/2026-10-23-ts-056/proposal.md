# Proposal

## Why

Sur Overview, le filtre « Projets avec urgences » (TS-054) indique quels
*projets* contiennent une urgence, mais pas *quelles étapes* restent à traiter.
L'utilisateur doit ouvrir chaque projet pour retrouver les actions urgentes,
leur projet d'origine et le moyen d'y accéder. Une synthèse transversale des
étapes urgentes répond à ce besoin sans créer de nouveau classement ni modifier
la suggestion déterministe déjà livrée.

## What Changes

- Ajouter sur Overview uniquement une zone compacte et distincte « Urgences à
  traiter », alimentée par le document métier déjà autorisé.
- Y lister chaque étape `done: false` et `priority: urgent`, tâche parente ou
  sous-tâche, indépendamment de l'état de son parent, de son repli, de l'aperçu
  de cinq parents, du filtre de projets et de « Masquer les étapes terminées ».
- Afficher pour chaque ligne le titre de l'étape, le nom du projet et, pour une
  sous-tâche, « Sous-tâche de [titre du parent] ». Tous les textes utilisateur
  sont rendus comme des nœuds texte, jamais comme du HTML interprété.
- Ordonner de façon déterministe selon l'ordre enregistré des projets, puis
  l'ordre enregistré des étapes, en plaçant une sous-tâche auprès de son
  parent. Aucun tri, déplacement ou changement de priorité n'est enregistré.
- Afficher initialement les cinq premières urgences, le nombre exact des
  urgences non affichées et les commandes « Voir toutes les urgences » /
  « Réduire ». L'état développé/réduit reste transitoire, en mémoire, sans
  stockage, export, synchronisation ni URL.
- Proposer une commande « Ouvrir dans le projet » identifiant le projet et
  l'étape par leurs IDs stables, ouvrant la vue de détail et révélant l'étape
  exacte, y compris une sous-tâche d'un parent replié ou une étape au-delà du
  quota de cinq parents. Si la cible a disparu, l'action est annulée proprement
  sans afficher le contenu d'un autre espace.
- Réactualiser la projection après priorité, complétion, suppression puis Undo,
  ajout, import réussi et événement Dexie autorisé, sans lecture, écriture,
  abonnement, requête réseau ou règle de suggestion supplémentaire.
- Préserver les compteurs globaux, la suggestion « Une étape pour maintenant »,
  « Je reprends ici », les filtres, les brouillons, le focus, le défilement et
  les annonces accessibles existants.

## Capabilities

### New Capabilities

- `overview-urgency-list`: projection globale et ordonnée des étapes urgentes
  en attente sur Overview, rendu compact et sûr, limite de cinq avec
  développement transitoire, ouverture par IDs stables avec révélation exacte,
  état vide autorisé et isolation de lecture/identité.

### Modified Capabilities

Aucune. Le changement est une nouvelle vue de lecture et de navigation. Il
réutilise la définition d'urgence en attente de `overview-project-metrics`,
l'état de lecture de `overview-project-read-state`, l'aperçu et le repli de
`subject-overview-preview` / `substep-collapse`, la révélation existante de
`next-action-suggestion` / `resume-tracking` et la continuité de
`ux-interaction-continuity` sans modifier leurs règles. Le filtre
`overview-urgency-filter` reste un filtre de projets et n'est pas transformé en
liste d'étapes.

## Impact

- `site/core.js` : constantes et fonctions pures de sélection, d'ordre, de
  quota et de recherche d'une cible par IDs stables, réutilisant la définition
  TS-053.
- `site/app.js` : conteneur statique, rendu borné à Overview, état transitoire
  développé/réduit, réinitialisations existantes, révélation sûre et gestion du
  focus.
- `site/index.html` et `site/styles.css` : section compacte, titres, liste,
  compteur, commandes accessibles et repli mobile sans débordement.
- Tests déterministes nouveaux (`tests/ts-056-overview-urgency-list.test.mjs`)
  et mises à jour ciblées des tests existants dont le balisage ou l'extraction
  du tableau de bord est affecté.
- Aucun changement de schéma IndexedDB, de données, d'export/import, de
  synchronisation, d'authentification, d'URL, d'historique, de workflow ASF, de
  secret ni de configuration Cloud.

## Assumptions and uncertainties

- C'est une vue de lecture et de navigation, pas un nouveau classement
  probabiliste ni une décision de prochaine action. « Urgence en attente »
  conserve exactement la définition TS-053 : `item.done === false` et
  `item.priority === "urgent"`.
- « Ordre des étapes dans leur projet » est interprété comme l'ordre enregistré
  dans `subject.items`, avec chaque sous-tâche placée auprès de son parent. Ce
  n'est pas l'ordre d'affichage trié par priorité des cartes. Si le produit
  voulait l'ordre visuel urgent → normal → plus tard, seul le modèle pur et ses
  tests seraient à ajuster ; cette ambiguïté est signalée sans choisir un tri
  persistant.
- Le Scope nomme la commande « Ouvrir dans le projet » alors que les critères
  d'acceptation écrivent « Voir dans le projet ». Le plan retient la
  formulation du Scope et traite l'autre comme une variante de libellé à
  confirmer ; le comportement (ouverture du détail et révélation) ne change pas.
- Le libellé exact du compteur d'excédent n'est pas imposé par le brief. Le plan
  exige un compteur exact des urgences non affichées, en français et accessible,
  sans figer une copie produit qui n'a pas été décidée.
- L'état développé/réduit suit les règles des états de présentation
  transitoires existants : conservé lors des mutations/rafraîchissements de la
  même vue et du même espace, réinitialisé à une véritable entrée de vue, un
  rechargement, un changement de compte/espace et un import/restauration
  réussis. Aucune préférence n'est créée.
- La limite de cinq est globale à la synthèse, pas une limite par projet.
- La zone et son message « Aucune urgence en attente » ne sont rendus qu'après
  une lecture métier autorisée et achevée. Pendant une lecture, une liaison non
  vérifiée ou une action requise, le chargement ou le diagnostic existant reste
  seul affiché.
- Aucune décision produit n'est prise sur des statistiques horodatées, un
  archivage métier, un partage, un tri persistant, de nouveaux statuts, une
  migration graphique ou une modification du moteur de recommandation.
