# Proposal

## Why

Le diagnostic Dexie Cloud complet est aujourd'hui rendu dans le flux global de
l'application, y compris sur Mes projets, alors qu'une page de paramètres dédiée
existe depuis TS-041. TS-043 donne à ce diagnostic une destination stable et
lisible, sans surcharger l'accueil, sans déplacer les formulaires sensibles et
sans modifier la synchronisation elle-même.

## What Changes

- Faire de `#/parametres/synchronisation` la page du diagnostic Dexie Cloud :
  titre « Synchronisation Dexie Cloud », synthèse de l'état courant et
  informations techniques déjà produites par `buildSyncDiagnostic` /
  `buildDiagnosticView`.
- Déplacer le nœud existant `#sync-diagnostic` dans cette page, sans changer son
  identifiant, son contenu dynamique, ses annonces accessibles, son bouton de
  relance ni son handler natif.
- Ajouter sur la page des emplacements descriptifs « Configuration »,
  « Première activation », « Connexion » et « Espaces de travail ». Aucun de
  leurs formulaires ou contrôles n'est déplacé, dupliqué ou activé ; leur
  raccordement reste TS-044.
- Conserver sur Mes projets un résumé de synchronisation minimal, en lecture
  seule, lorsque l'état configuré nécessite une attention (session, connexion,
  phase, pull initial, écritures locales ou erreurs) ou qu'une erreur locale
  existe. Le résumé ne contient aucune action et ne remplace pas la page.
- Montrer explicitement « Cloud non configuré » et « local uniquement » dans
  l'état sans configuration, sans ouverture d'instance Cloud, sans OTP et sans
  requête réseau.
- Réutiliser les signaux et abonnements natifs existants (`currentUser`,
  `syncState`, `persistedSyncState`) : aucun nouvel abonnement, aucune nouvelle
  connexion, aucun pull automatique, aucune écriture ni nouvelle preuve de
  présence distante.
- Préserver les conditions du bouton « Relancer le pull » : un changement de
  route ne le déclenche pas et ne modifie ni `canRetryInitialPull` ni
  `syncDiagnosticsController.retry`.

## Capabilities

### New Capabilities

Aucune. Le changement réorganise une présentation et un résumé déjà fondés sur
des comportements spécifiés.

### Modified Capabilities

- `app-navigation` : la page `#/parametres/synchronisation` n'est plus
  descriptive ; elle héberge le diagnostic complet et des emplacements
  descriptifs pour les futurs contrôles. La navigation reste une opération de
  présentation et conserve le contexte diagnostique.
- `cloud-sync-lifecycle` : ajout du contrat de page de diagnostic dédiée et du
  résumé d'attention sur Mes projets, construits sur les mêmes signaux natifs,
  sans nouvelle synchronisation ni exposition de secrets.

## Impact

- `site/index.html` : déplacement de `#sync-diagnostic` dans
  `#settings-sync-page`, ajout du résumé `#sync-summary` et des sections
  descriptives.
- `site/styles.css` : présentation de la page de diagnostic, des sections
  descriptives et du résumé, y compris à 320 px et avec `hidden`.
- `site/sync-diagnostics.js` : ajout d'un modèle pur de synthèse/visibilité du
  résumé, sur les mêmes entrées et sans accès réseau, DOM ou stockage.
- `site/app.js` : rendu de la page et du résumé depuis le diagnostic existant,
  visibilité du résumé selon la route, sans appel de relance ni réabonnement.
- `tests/ts-041-navigation.test.mjs`,
  `tests/ts-042-data-page.test.mjs`, `tests/sync-diagnostics.test.mjs` et
  nouveau `tests/ts-043-sync-page.test.mjs` : emplacement DOM, résumé, absence
  d'effets de bord, cycle de vie des abonnements et non-exposition de secrets.
- `docs/product/guide-utilisation.md` et
  `docs/product/acceptance-checklist.md` : destination et usage du diagnostic.
- Aucun changement de schéma IndexedDB, de configuration Cloud, de flux OTP,
  de consentement, de purge, de session, de format d'import/export ni de
  workflow.

## Non-Goals

- Déplacer `#workspace-panel`, `#cloud-activation`, `#cloud-config` ou
  `#auth-panel`, ni modifier leurs comportements : ce raccordement est TS-044.
- Modifier les opérations Cloud, la gestion des espaces, la reprise de session,
  l'activation, le consentement, la déconnexion ou la purge.
- Créer un nouveau mécanisme de synchronisation, d'authentification, de
  diagnostic ou de preuve distante.
- Rafraîchir, réabonner ou relancer automatiquement le diagnostic lors d'un
  changement de route.
- Exposer un email, un OTP, un token, un secret ou un contenu métier dans la
  page ou le résumé.

## Uncertainties and decisions

- **Seuil du résumé sur Mes projets.** Interprétation retenue du brief : le
  résumé est visible pour tout état Cloud configuré qui n'est pas entièrement en
  phase ou qui porte une erreur, ainsi que pour une erreur locale de lecture ou
  d'écriture. Il reste masqué pour un espace local non configuré sans erreur et
  pour une synchronisation configurée entièrement en phase. La page dédiée
  reste, elle, toujours accessible et complète.
- **Preuve distante.** Le diagnostic ne reçoit aucune nouvelle capacité de
  lecture distante. L'absence de preuve, un pull en attente ou un échec restent
  explicitement « non déterminé » ou « non considéré comme vide ».
- **Libellés et mise en page.** Les formulations françaises exactes du résumé,
  des sections descriptives et les classes CSS peuvent être ajustées pendant
  `apply` sans changer les scénarios observables.
