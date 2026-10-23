# Proposal

## Why

Depuis « Mes projets », l'utilisateur doit parcourir toutes les cartes pour
repérer les projets qui contiennent encore une urgence non terminée. TS-053 a
livré une définition unique et vérifiée de l'urgence en attente, mais aucun
moyen de restreindre temporairement la liste à ces projets. Ce changement
ajoute ce filtre de lecture, sans transformer la priorisation en préférence
persistante ni modifier les données.

## What Changes

- Ajouter dans Overview un contrôle accessible et explicite à deux états,
  « Tous les projets » (état initial) et « Projets avec urgences », à proximité
  de la liste.
- En mode « Projets avec urgences », n'afficher que les sujets comportant au
  moins une étape `priority: urgent` et `done: false`, parent ou sous-tâche,
  même si le parent est terminé ou replié. Conserver l'ordre d'origine, la
  limite de cinq parents par carte et toutes les interactions existantes.
- Recalculer le résultat depuis le document courant après toute mutation
  locale, actualisation Dexie ou inter-onglets, et après un Undo dans le même
  espace et la même route. Un projet quitte le résultat dès que sa dernière
  urgence est terminée ou dépriorisée.
- Afficher, quand aucun projet ne correspond, « Aucun projet avec urgence en
  attente » avec une action de retour vers « Tous les projets », jamais le
  message d'absence générale de projet.
- Conserver les compteurs globaux TS-053, la suggestion « Une étape pour
  maintenant », la carte « Je reprends ici » et leurs règles globales. Si une
  action « Voir dans la liste » cible un projet masqué par le filtre, révéler
  l'action de façon sûre via la vue de détail ou le retour à « Tous les
  projets », sans changer les priorités ni écrire.
- Garder le filtre uniquement en mémoire pendant la visite courante et les
  rafraîchissements autorisés du même espace. Le réinitialiser à une véritable
  entrée de vue, un rechargement, un changement d'espace ou de compte, et un
  import ou une restauration réussis. Ne jamais le persister, l'exporter,
  l'inclure dans une URL ou le synchroniser.
- Laisser le filtre « Masquer les étapes terminées » totalement indépendant :
  le filtre urgent ne modifie aucun champ métier et ne masque aucune étape
  éligible à l'intérieur d'un projet affiché.

## Capabilities

### New Capabilities

- `overview-urgency-filter` : contrôle transitoire de la liste des projets
  d'Overview, sélection dérivée des urgences en attente TS-053, état vide
  dédié, durée de vie et réinitialisations, révélation sûre des cibles
  masquées, et préservation des compteurs globaux et de la continuité UI.

### Modified Capabilities

Aucune exigence existante n'est modifiée. Le filtre réutilise la définition
d'urgence en attente de `overview-project-metrics`, respecte l'état de lecture
de `overview-project-read-state`, l'aperçu de `subject-overview-preview` et la
continuité de `ux-interaction-continuity` sans en changer les règles.

## Impact

- `site/core.js` : fonctions pures de sélection d'un projet selon son urgence
  en attente et de filtrage ordonné de la liste, réutilisant `subjectMetrics`.
- `site/app.js` : état transitoire du filtre, synchronisation du contrôle,
  branche de rendu filtrée, état vide dédié, branchement aux réinitialisations
  existantes et révélation sûre des cibles masquées.
- `site/index.html` et `site/styles.css` : contrôle natif accessible, cible
  tactile suffisante, repli mobile sans débordement et focus visible.
- Nouveaux tests déterministes, plus d'éventuelles mises à jour ciblées des
  tests existants qui comptent les cartes ou les points de réinitialisation.
- Aucun changement de schéma IndexedDB, de colonne, de préférence, d'export ou
  d'import, de synchronisation, d'authentification, de lecture Dexie, de
  réseau, d'URL, de workflow ASF, de secret ou de configuration Cloud.

## Assumptions and uncertainties

- Le filtre s'applique aux projets, pas aux étapes à l'intérieur des cartes :
  un projet retenu conserve son aperçu habituel, son filtre « Masquer les
  étapes terminées » et ses cinq parents visibles au maximum.
- « Urgence en attente » est exactement le calcul de TS-053
  (`subjectMetrics(subject).urgentPending > 0`), y compris les sous-tâches et
  indépendamment du repli ou du filtre d'affichage.
- Le brief laisse deux options pour révéler une cible masquée. Le plan retient
  la navigation vers la vue de détail du projet, qui existe déjà et rend
  l'action ciblée accessible sans sauvegarde. Cette navigation étant une vraie
  entrée de vue, le filtre est réinitialisé au retour.
- L'action de l'état vide est un contrôle nommé « Tous les projets », cohérent
  avec l'état initial du filtre.
- Le brief ne précise pas si réactiver « Mes projets » alors que la route est
  déjà Overview constitue une nouvelle entrée de vue. Le plan suit la
  sémantique existante `isViewEntry` : seul un changement réel de vue
  réinitialise ; un simple rendu ou rafraîchissement du même espace conserve le
  filtre. Cette convention pourra être révisée si la recette produit la juge
  insuffisante.
- Le contrôle exact (groupe de boutons ou boutons radio) est un choix
  d'implémentation. Le plan retient un groupe de boutons radio natifs, avec un
  état coché annoncé par le navigateur et sans nouvelle région `aria-live`.
- Aucune décision produit n'est prise sur un tri persistant, un statut projet,
  un filtre global synchronisé, une recherche transversale, des graphiques,
  une modification des suggestions ou de la reprise, ou une refonte visuelle.
