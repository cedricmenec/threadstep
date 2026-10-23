# Proposal

## Why

Sur Overview, les projets dont toutes les étapes sont cochées restent mêlés aux
projets encore à travailler. L'utilisateur doit pouvoir retrouver rapidement
les projets à faire et consulter les projets achevés à la demande, sans
parcourir toute la liste. Le sélecteur de projets existant (TS-054) fournit
déjà « Tous les projets » et « Projets avec urgences » ; l'étendre évite de
créer un second filtre concurrent et n'exige aucun statut stocké ni archivage
réel, puisque « terminé » se calcule à partir des étapes présentes.

## What Changes

- Étendre le sélecteur de projets existant à quatre modes exclusifs :
  « Tous les projets » (état initial inchangé), « Projets avec urgences »
  (comportement TS-054 inchangé), « Projets à suivre » et « Projets terminés ».
- Calculer « à suivre » et « terminé » uniquement à partir de l'état présent
  des tâches et sous-tâches. Un projet sans étape n'apparaît que dans « Tous
  les projets » et n'est jamais classé terminé.
- Filtrer uniquement la présentation : conserver l'ordre stocké, la limite de
  cinq parents dans l'aperçu, les opérations, les réglages de carte et le
  filtre distinct « Masquer les étapes terminées ».
- Afficher des états vides dédiés et exacts « Aucun projet à suivre » et
  « Aucun projet terminé », avec une action de retour vers « Tous les
  projets », uniquement après une lecture métier autorisée et achevée.
- Garder le mode sélectionné lors des mutations et rerendus autorisés dans la
  même vue ; le réinitialiser à « Tous les projets » sur une véritable entrée
  de vue, un rechargement, un changement de compte ou d'espace et un import ou
  une restauration réussis. Aucune préférence n'est stockée.
- Laisser les compteurs globaux, la carte « Je reprends ici » et la suggestion
  indépendants du mode actif. « Voir dans la liste » doit révéler la tâche
  ciblée même lorsque son projet est masqué.
- Ne créer aucun statut persistant, aucune colonne, aucun champ d'export,
  aucune préférence, aucune lecture Dexie supplémentaire, aucun appel réseau,
  aucun changement d'authentification et aucun contenu HTML interprété.

## Capabilities

### New Capabilities

Aucune. Le changement étend une capacité existante plutôt que d'introduire un
second filtre de projets concurrent.

### Modified Capabilities

- `overview-urgency-filter` : le contrôle devient un sélecteur de projets à
  quatre modes exclusifs ; la classification « à suivre » / « terminé »,
  les états vides correspondants, la durée de vie transitoire, la révélation
  des cibles masquées, la sécurité de lecture et les invariants de continuité
  sont généralisés aux nouveaux modes sans changer la sémantique du mode
  urgence.

## Impact

- `site/core.js` : constantes de mode, classification pure d'un projet et
  extension du filtrage ordonné, réutilisant `subjectMetrics()`.
- `site/app.js` : état transitoire du mode, synchronisation du groupe de
  boutons radio, rendu filtré, états vides dédiés, réinitialisations
  existantes et révélation sûre des cibles masquées.
- `site/index.html` et `site/styles.css` : deux options radio supplémentaires
  dans le groupe existant, libellés exacts, cible tactile et repli mobile.
- Tests déterministes nouveaux et mise à jour ciblée des tests existants qui
  comptent les options du sélecteur ou simulent son rendu.
- Aucun changement de schéma IndexedDB, de données, d'export/import, de
  synchronisation, d'authentification, d'URL, de workflow ASF, de secret ou de
  configuration Cloud.

## Assumptions and uncertainties

- « Terminé » est calculé sur l'état présent (`total > 0` et aucune étape en
  attente) ; ce n'est ni un statut sauvegardé, ni un archivage, ni une
  suppression.
- « À suivre » signifie au moins une tâche ou sous-tâche non terminée,
  exactement comme `subjectMetrics(subject).active`. Un parent terminé dont
  une sous-tâche reste à faire est donc à suivre.
- Le mode « Projets avec urgences » garde exactement sa définition TS-054
  (`urgentPending > 0`). Un projet entièrement terminé n'y apparaît pas.
- Le sélecteur reste un groupe de boutons radio natifs dans le `fieldset`
  « Filtrer les projets ». Les libellés exacts des nouveaux modes sont
  « Projets à suivre » et « Projets terminés ».
- L'action de retour des états vides reste « Tous les projets » dans la même
  vue, sans navigation, comme pour l'état vide urgent existant.
- Le changement de mode n'est pas une entrée de vue : il conserve les groupes
  développés, les brouillons et le défilement selon le contrat de continuité.
- Aucune décision produit n'est prise sur un archivage réel, un statut projet
  persistant, un historique, un partage, une collaboration, un tri persistant,
  une recherche, une préférence synchronisée ou une refonte visuelle.
- La capacité existante `overview-urgency-filter` conserve son chemin pour
  éviter une duplication ; sa formulation de purpose devra être vérifiée lors
  de la revue post-sync pour refléter les quatre modes.
