# Proposal

## Why

Sur `#/`, une restauration Cloud saine traverse encore des états natifs
ordinaires (`loading`, `connecting`, `initial`, pull initial en attente) que le
résumé d'attention traite comme des anomalies. Le bandeau et le lien peuvent
donc apparaître puis disparaître pendant que les projets se chargent, en
déplaçant l'interface et en produisant des annonces répétées. Le code actuel
constitue une cause plausible de ce clignotement ; la reproduction instrumentée
sur l'appareil réel reste à confirmer en recette.

## What Changes

- Introduire un modèle pur et testable des états de présentation de Mes
  projets : initialisation transitoire, lecture métier autorisée en attente,
  projets disponibles, incident ou action requise.
- Dériver la disponibilité des projets de la lecture métier autorisée et de
  `documentLoaded`, jamais de `in-sync`, d'un délai ou d'une preuve distante.
- Ne plus afficher `#sync-summary` ni `#sync-settings-access` pour les
  transitions ordinaires. Les réserver aux erreurs confirmées, aux sessions
  nécessitant une reconnexion, aux blocages de liaison et aux attentes
  durablement non résolues.
- Afficher un composant compact et stable « Chargement de vos projets… » dans
  l'emplacement de la liste lorsqu'une lecture réellement nécessaire empêche
  l'affichage des projets. Ne jamais présenter une liste vide, un compteur nul
  ou une suggestion vide comme une lecture réussie.
- Conserver la liste déjà affichée pendant les synchronisations de fond sous la
  même identité autorisée, sans réutiliser le document d'un autre compte ni
  d'une base non vérifiée.
- Ajouter au besoin une courte temporisation de présentation, annulable et
  testée. Aucun délai ne peut autoriser une lecture, fabriquer une preuve
  distante ou retarder l'affichage d'une erreur avérée.
- Préserver le diagnostic complet, les commandes OTP, les reprises manuelles et
  leurs garde-fous dans `#/parametres/synchronisation`.

## Capabilities

### New Capabilities

- `overview-project-read-state` : états de présentation observables de Mes
  projets, chargement stable, conservation de la liste pendant une
  synchronisation de fond, seuils de présentation annulables et annonces
  accessibles non oscillantes.

### Modified Capabilities

- `cloud-sync-lifecycle` : le résumé d'attention de la vue d'ensemble n'est
  plus déclenché par les états natifs transitoires ordinaires ; il est limité
  aux incidents confirmés, sessions nécessitant une action, blocages de
  liaison et attentes durablement non résolues.
- `cloud-settings-hub` : le lien contextuel de Mes projets suit les mêmes
  déclencheurs restreints et reste masqué pendant une restauration saine ou
  lorsqu'une synchronisation de fond laisse les projets consultables.

## Impact

- `site/app.js` : calcul et application des états de présentation, visibilité
  de `#sync-summary`, de `#sync-settings-access`, de la liste et du nouveau
  chargement ; temporisation de présentation annulable.
- `site/index.html` et `site/styles.css` : zone de chargement stable, états
  `role="status"`/`aria-busy`, dimensions et comportement sans animation
  imposée.
- Nouveau module pur pour le modèle d'états et nouveau fichier de tests
  déterministes ; mise à jour des tests existants qui considèrent encore
  `connecting`, `initial` ou un pull en attente comme une alerte de Mes
  projets.
- Aucun changement de schéma, de données, d'export/import, de synchronisation,
  d'authentification, de workflow ASF, de secret ou de configuration Dexie
  Cloud.

## Assumptions and uncertainties

- Le clignotement décrit est traité comme un défaut de présentation causé par
  les signaux actuels ; sa reproduction complète sur l'appareil de
  l'utilisateur n'est pas établie. La recette réelle doit confirmer ou infirmer
  cette cause.
- Le seuil exact de la courte temporisation et celui de l'attente durable sont
  des choix techniques déterministes, définis et testés pendant `apply` ; ils
  ne constituent pas une règle métier et ne peuvent jamais autoriser une
  lecture ou masquer une erreur.
- Les libellés français exacts de l'aide concise peuvent être ajustés pendant
  l'implémentation tant qu'ils restent non trompeurs, persistants et
  accompagnés d'un accès à Paramètres > Synchronisation.
- Aucune nouvelle décision produit n'est prise sur les flux OTP, la
  récupération, la purge, la sélection d'espace ou la synchronisation native.
