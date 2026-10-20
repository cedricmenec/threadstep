# Proposal

## Why

ThreadStep persiste désormais ses données dans IndexedDB et propose une
activation Dexie Cloud facultative, mais la documentation actuelle disperse les
notions de base locale, de cache par espace, de transfert, de preuve de
synchronisation et de récupération. Une personne non technique ne peut pas
savoir avec certitude où sont ses projets, quelles copies existent, ni quelle
procédure sûre suivre avant une déconnexion, un import, une restauration ou une
purge. L'incident de cache `UNVERIFIED` rappelle qu'une formulation trop
optimiste peut laisser croire à une perte ou à une synchronisation prouvée.

## What Changes

- Ajouter un guide autonome sous `docs/product/` qui décrit le modèle
  local-first réellement livré : base autonome `threadstep-local`,
  IndexedDB locale distincte par espace Cloud `threadstep-ws-…`, instance
  distante répliquée sous conditions, et cache de récupération local
  `threadstep-recovery-…`.
- Relier ce guide depuis `docs/product/guide-utilisation.md` et les références
  de documentation produit adaptées, sans dupliquer le guide ni modifier le
  comportement applicatif.
- Distinguer explicitement « enregistré sur cet appareil », « transfert local
  en attente », « pull natif terminé », « synchronisation native en phase »,
  « lecture métier attestée » et « contenu confirmé sur un autre appareil ».
  Le guide ne doit jamais présenter `in-sync` comme la preuve que toute la
  copie distante est complète.
- Documenter des scénarios et tableaux de décision courts couvrant le premier
  lancement local, la configuration sans activation, l'activation avec
  OTP/lecture/plan/consentement, la connexion sur un autre appareil, la
  suspension, la déconnexion, le changement d'espace/d'URL/de compte, le retour
  au local, la reprise Cloud, le hors ligne et les erreurs, les écritures non
  transmises, les caches `UNVERIFIED`/`MISMATCH`, la récupération isolée, les
  sauvegardes/imports/exports et la suppression des données navigateur.
- Rendre explicites, pour chaque scénario, l'état avant/après : espace actif,
  données consultables localement, destinataire distant éventuel, données
  conservées mais non affichées, danger, sauvegarde conseillée, action exacte
  et possibilité de retour arrière.
- Ajouter une FAQ de dépannage priorisée, un glossaire sans jargon, les limites
  de durabilité du stockage et des sauvegardes, les permissions Cloud,
  l'authentification, l'état hors ligne, l'absence de propagation distante
  attestée, et des liens vers les sources officielles Dexie.
- Ajouter des tests documentaires déterministes qui vérifient la présence du
  guide, ses liens, sa couverture de scénarios, la terminologie du code actuel,
  l'absence de promesse de synchronisation non prouvée et l'absence de données
  personnelles ou de secrets.

## Capabilities

### New Capabilities

- `persistence-user-guide` : documentation utilisateur durable expliquant la
  persistance IndexedDB, les espaces Dexie Cloud, les copies, les preuves de
  synchronisation, les scénarios de transition et les procédures sûres.

### Modified Capabilities

- Aucune : le comportement applicatif, les formats, les schémas et les règles
  de synchronisation restent inchangés. Seule la documentation produit évolue.

## Impact

- Nouveau guide `docs/product/guide-persistance-et-synchronisation.md`.
- Liens et références dans `docs/product/guide-utilisation.md`,
  `docs/product/dexie-cloud-rollout.md`, `docs/product/acceptance-checklist.md`
  et, si pertinent, `README.md`, sans modifier les contrôles ni les parcours.
- Nouveau test déterministe `tests/ts-046-persistence-guide.test.mjs`, exécuté
  par `npm test` et donc par `npm run check`.
- Aucun changement de code applicatif, de schéma IndexedDB, de configuration,
  de secret, de workflow ASF ou de spécification canonique de comportement.

## Non-goals

- Corriger le bug de liaison ou le diagnostic (TS-045, TS-047).
- Modifier les formulaires, les handlers, les bases existantes ou les règles de
  synchronisation.
- Reproduire l'ancien parcours V1 obsolète ou promettre une récupération V1.
- Inspecter des données personnelles en production ou exécuter une recette
  destructive sur une base personnelle.
- Déclarer une convergence inter-appareils comme prouvée par un test, un état
  `in-sync`, un pull attesté ou une lecture locale.

## Uncertainties and decisions to confirm

- La cause racine de l'incident `UNVERIFIED` reste inconnue à la préparation
  (TS-045). Le guide décrit donc les états observables et les actions sûres,
  sans inventer de cause ni de garantie de propagation.
- La documentation doit rester fidèle à l'état livré au moment de sa
  publication. Si TS-045 ou TS-047 découvre un écart réel avant publication,
  le guide est corrigé dans la PR de correctif correspondante ; aucune
  garantie théorique n'est transformée en fait vérifié.
- Le nom définitif du guide, ses ancres et l'ordre exact des tableaux restent
  des choix éditoriaux réversibles, à condition de conserver la couverture et
  les liens exigés par la tâche.
