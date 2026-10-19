# Proposal

## Why

Le diagnostic Dexie Cloud est désormais sur `#/parametres/synchronisation`, mais
les contrôles de configuration, d'activation, de connexion et de gestion des
espaces restent dispersés dans la page principale. L'utilisateur doit donc
chercher plusieurs endroits pour comprendre l'étape suivante, tandis que les
protections de consentement, de réconciliation et de purge restent à préserver
sans duplication.

## What Changes

- Regrouper sur `#/parametres/synchronisation` les contrôles existants
  `#cloud-config`, `#cloud-activation`, `#auth-panel` et `#workspace-panel`,
  ainsi que leurs actions de sélection d'espace, suspension, déconnexion et
  purge locale. Le diagnostic TS-043 reste sur la même page.
- Afficher un parcours d'onboarding contextuel dérivé des états existants :
  local autonome, configuration HTTPS, activation opt-in, OTP, premier pull,
  plan de rapprochement, consentement, transfert et suivi des erreurs.
- Ajouter un accès contextuel depuis Mes projets vers cette page lorsqu'un
  blocage ou une erreur de session réclame une action, sans lancer d'action ni
  transformer le résumé de synchronisation en bouton.
- Préserver l'état d'un formulaire OTP en cours, d'une erreur ou d'une revue
  d'activation lors des changements de page ; seule une action explicite peut
  soumettre, annuler, confirmer ou purger.
- Conserver les identifiants, handlers et modules métier existants. Le
  déplacement est une opération de présentation : aucun rechargement,
  réinitialisation ou ouverture de base au changement de route.
- Maintenir les quatre actions distinctes « Se déconnecter », « Suspendre
  Cloud », « Changer d'espace » et « Purger la copie locale », avec nom de base,
  portée, avertissements, sauvegarde préalable et confirmation.

## Capabilities

### New Capabilities

- `cloud-settings-hub`: centralisation de la configuration, de l'onboarding et
  des comptes Cloud sur une page de paramètres, continuité des états entre les
  routes et accès contextuel depuis la vue d'ensemble.

### Modified Capabilities

- `app-navigation`: la page Synchronisation n'est plus composée d'emplacements
  descriptifs ; elle héberge les contrôles réels une seule fois, et les
  changements de route restent sans effet sur la base ou les états en cours.
- `cloud-sync-lifecycle`: la page dédiée associe diagnostic en lecture seule et
  contrôles Cloud intégrés, et le résumé de Mes projets peut proposer un lien
  d'accès vers cette page sans proposer de relance.

## Impact

- `site/index.html` : déplacement des sections existantes dans
  `#settings-sync-page`, avec de nouveaux conteneurs de section et un lien
  d'accès contextuel.
- `site/app.js` : visibilité par route, dérivation d'onboarding et d'accès
  contextuel ; les modules et handlers de configuration, OTP, activation et
  espaces restent la source de vérité.
- `site/styles.css` : mise en page des sections intégrées, cibles accessibles et
  absence de débordement horizontal.
- `tests/ts-041-navigation.test.mjs`, `tests/ts-043-sync-page.test.mjs` et
  nouveaux tests `ts-044-*` : mise à jour des attentes de déplacement et ajout
  des scénarios de navigation, OTP, consentement, divergence, hors ligne,
  rechargement et transitions d'espaces.
- `docs/product/guide-utilisation.md` et `docs/product/acceptance-checklist.md` :
  description du nouveau lieu unique et de la recette associée.
- Aucun changement de schéma IndexedDB, de protocole Dexie Cloud, de workflow
  ASF, de secret ni de format de sauvegarde.

## Non-goals

- Créer un nouveau mode d'authentification ou un backend applicatif.
- Modifier les algorithmes de migration, de réconciliation, de synchronisation
  ou de purge.
- Supprimer, migrer ou réinitialiser des bases IndexedDB existantes.
- Contourner `requireAuth`, les validations Dexie, l'isolation des comptes ou
  les confirmations.
- Trancher une régression métier Cloud existante par un simple déplacement
  d'interface.

## Uncertainties and decisions to confirm

- Le libellé et la position exacte du lien d'accès depuis Mes projets ne sont
  pas imposés par le brief. Le plan retient un lien distinct, non destructif et
  non interactif vis-à-vis du résumé, affiché uniquement lorsqu'un état Cloud
  configuré nécessite une action ou qu'une erreur locale est présente.
- L'ordre visuel exact des sections de la page de synchronisation reste une
  décision d'implémentation. Le plan retient : onboarding, configuration,
  activation, connexion, espaces de travail, puis diagnostic.
- Les régressions Cloud réelles et la recette sur un compte Dexie réel restent
  hors de portée de la CI ; elles figurent en acceptance manuelle et ne sont
  pas considérées comme prouvées par les tests simulés.
