# Proposal

## Why

La page `#/parametres/synchronisation` expose aujourd'hui des dimensions
techniques juxtaposées (session, connexion, phase native, pull initial,
écritures, liaison, bootstrap) que l'utilisateur non technique doit décoder
lui-même. Après un blocage `UNVERIFIED` ou une session expirée, il ne sait pas
immédiatement où sont ses données, si elles sont réellement synchronisées, ni
quelle action est sûre — alors que certaines actions voisines sont destructrices.
TS-045 fiabilise la liaison de cache et TS-046 fournit le référentiel
pédagogique ; TS-047 peut désormais rendre cette vérité lisible et actionnable
sans modifier les mécanismes de synchronisation.

## What Changes

- Recomposer la page en trois questions successives : « Où sont mes données ? »,
  « Sont-elles synchronisées ? », « Que puis-je faire maintenant ? », avec un
  résumé immédiatement lisible avant tout diagnostic technique.
- Afficher sans dépliage le mode actif, le nom effectif de la base IndexedDB
  locale, et pour une session Cloud l'URL normalisée, le `remoteDbId` disponible,
  l'état de session et de connexion.
- Rendre explicites les libellés de localisation : « Local uniquement, enregistré
  sur cet appareil » ou « Copie locale IndexedDB reliée à Dexie Cloud », et, si
  la preuve manque, « Données Cloud temporairement masquées, non présumées
  perdues ».
- Séparer trois niveaux de preuve : « Modifications enregistrées sur cet
  appareil », « Modifications en attente d'envoi » (ou état inconnu) et
  « Synchronisation Cloud observée ». Aucun libellé global « tout est sauvegardé
  dans le Cloud » n'est produit sans preuve.
- Afficher une date de dernière synchronisation observée **uniquement** lorsqu'un
  événement natif de réussite est attribuable à la session, l'URL, l'espace local
  et la base distante courants. Sinon afficher « Date non disponible », jamais
  l'heure du chargement.
- Différencier la sauvegarde locale, le dernier événement Cloud observé sur cet
  appareil et la vérification sur un autre appareil (jamais affirmée).
- Traduire chaque état natif et blocage en langage naturel : signification,
  données conservées ou masquées, risque concret, action sûre et actions
  interdites, via une aide contextuelle compacte accessible au clavier et au
  toucher.
- Ajouter une checklist conditionnelle pour cinq intentions : rester en local,
  synchroniser cet appareil, retrouver ses projets sur un nouvel appareil,
  revenir au local, corriger un blocage. Elle réutilise exclusivement les
  contrôles et confirmations existants ; aucun transfert, relance, déconnexion
  ou purge implicite.
- Conserver les panneaux métier existants accessibles dans des sections
  dépliables, sans duplication d'identifiant ni d'handler, et reléguer les
  identifiants techniques sous « Informations techniques ».
- Traiter explicitement les états base locale vide, cache masqué, compte
  différent, preuve distante inconnue, erreur de stockage et réseau interrompu,
  sans jamais conclure qu'une cible Cloud est vide.

## Non-goals

- Aucun nouvel algorithme de réplication, aucune gestion serveur Dexie Cloud,
  aucune fusion automatique local/Cloud, aucun changement des règles d'accès.
- Aucune purge implicite, aucun transfert, aucune relance ou déconnexion
  automatique, aucune modification des workflows ASF.
- Aucune refonte hors de la page de synchronisation ; la correction de la liaison
  de cache reste TS-045 et le guide utilisateur reste TS-046.

## Capabilities

### New Capabilities

- `cloud-sync-trust-guidance`: résumé de confiance immédiat, séparation des
  preuves, explications en langage naturel des états natifs et checklist
  d'intentions sûre réutilisant les contrôles existants.

### Modified Capabilities

- `cloud-settings-hub`: hiérarchie progressive en trois questions et panneaux
  métier repliables, sans duplication de contrôle ni effet de navigation.
- `cloud-sync-lifecycle`: observation horodatée de dernière synchronisation
  attribuée à la session, l'URL, l'espace et la base distante courants, avec
  « Date non disponible » en l'absence de preuve.

## Impact

- Interface : `site/index.html`, `site/styles.css`, `site/app.js`.
- Nouveau module de présentation pur et testable :
  `site/sync-trust-guidance.js`.
- Nouvelle observation locale passive, cloisonnée par workspace et sans donnée
  métier, si la voie native retenue est validée en implémentation (clé locale
  dédiée ; aucune migration destructive, aucune donnée synchronisée).
- Tests : nouveau fichier de tests déterministes TS-047 et ajustement des
  assertions TS-043/TS-044 devenues obsolètes uniquement là où la hiérarchie
  change. `npm run check` et `openspec validate ts-047 --strict` restent requis.
- Aucun changement de schéma métier, d'export/import JSON, de règles de compte,
  de consentement ou de purge.

## Unresolved decisions

- **Sémantique de l'horodatage natif.** Le `SyncState` public exposé par
  `dexie-cloud-addon` 4.4.15 fournit `status`, `phase`, `progress` et `error`,
  pas une date de dernière synchronisation documentée comme contrat stable.
  `persistedSyncState.timestamp` existe dans l'implémentation mais n'est pas
  présumé public. Le plan retient donc comme défaut honnête « Date non
  disponible » ; une observation locale n'est enregistrée que si l'événement
  natif de réussite est attribuable et si l'implémentation prouve cette
  attribution par des tests. Si ce n'est pas démontrable, aucune date n'est
  affichée et le libellé reste « Date non disponible ».
- **Portée exacte de la preuve multi-appareils.** Aucun signal local ne peut
  prouver la convergence d'un autre appareil ; la recette réelle multi-appareils
  reste manuelle et hors checklist.
