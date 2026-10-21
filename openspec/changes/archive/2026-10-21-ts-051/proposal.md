# Proposal

## Why

Le 21 octobre 2026, sur Chrome Android, l'application est restée bloquée entre
`Session en cours de restauration`, `Connexion en cours`, `Synchronisation
initiale`, `Lecture distante bloquée` et `Pull initial en attente`, sans moyen
simple de partager un état expurgé avec une personne ou un assistant. TS-045 et
TS-048 traitent la reprise et la visibilité ; cette tâche apporte uniquement
l'observabilité et le partage contrôlé du diagnostic, y compris quand
l'authentification et la première synchronisation ne se terminent jamais.

## What Changes

- Ajouter dans `#/parametres/synchronisation`, section « Diagnostic de
  synchronisation », un bouton explicite « Copier le diagnostic pour
  assistance », disponible dans tous les états transitoires, hors ligne et en
  erreur, sans dépendre d'une session authentifiée ni d'une lecture distante.
- Construire à la demande, depuis les modèles normalisés existants, un rapport
  Markdown structuré et reproductible : horodatages local/UTC, navigateur non
  identifiant, version/build si réellement disponible, espace actif anonymisé,
  réseau, session, connexion, phase native, pull initial, écritures, preuve
  distante et raison, liaison de compte, erreurs normalisées, bootstrap,
  possibilité et raison de relance.
- Instrumenter en mémoire, sans effet sur le bootstrap, l'ouverture de la base
  effective et les signaux natifs `currentUser`, `syncState`,
  `persistedSyncState`, ainsi que le lancement et l'issue d'une demande OTP.
  Afficher des âges arrondis et bornés, ou `non disponible` sans mesure.
- Distinguer restauration de session, session absente, session expirée et refus
  natif explicitement constaté ; ne pas déduire un refus serveur de la seule
  absence d'identité.
- Appliquer une liste blanche à la source du rapport et anonymiser bases et
  identifiants distants ; masquer l'origine Cloud par défaut. Aucun email, OTP,
  token, cookie, identifiant de compte, message brut, stack, URL sensible,
  contenu métier ou donnée de suivi ne doit entrer dans le rapport.
- Copier avec `navigator.clipboard.writeText` dans un contexte sécurisé, avec
  confirmation accessible et aperçu sélectionnable. En cas d'API absente ou de
  refus, présenter le rapport complet dans un champ sélectionnable et expliquer
  la copie manuelle sans prétendre à un succès.
- Préserver la navigation, le focus, le scroll et les états locaux ; ne
  déclencher ni reconnexion, ni OTP, ni migration, ni pull, ni purge, ni
  récupération, ni écriture, ni stockage, ni télémétrie, ni appel à une IA.

## Capabilities

### New Capabilities

- `sync-diagnostic-sharing` : rapport de diagnostic partageable, expurgé à la
  source, copie avec repli manuel, instrumentation mémoire du cycle
  d'initialisation et invariants d'accessibilité associés.

### Modified Capabilities

Aucune. Le diagnostic natif en lecture seule et ses garanties TS-034, TS-043,
TS-045, TS-047 et TS-048 restent inchangés ; la nouvelle surface de partage est
une capacité distincte qui consomme leurs modèles normalisés.

## Impact

- Nouveau module pur et testable pour le rapport (sérialisation Markdown,
  liste blanche, libellés anonymisés, âges bornés) et tests Node associés.
- Instrumentation locale en mémoire pour `db.open()` et les observables natifs,
  branchée passivement dans `site/app.js` et le parcours OTP existant.
- `site/app.js` : bouton, aperçu, presse-papiers, repli manuel, messages
  accessibles et styles mobiles dans `site/styles.css` ; aucun nouvel
  abonnement natif, aucune requête et aucune migration.
- `#/parametres/synchronisation` reste en lecture seule vis-à-vis des données,
  de la session et du Cloud ; `npm run check` couvre le nouveau module.
- Aucun changement de workflow ASF, de secret, de configuration distante,
  de base IndexedDB, de format d'export/import ni de dépendance.

## Assumptions and uncertainties

- La page et le diagnostic natif existent déjà ; la copie réutilise leur
  projection expurgée et ne crée pas un second diagnostic.
- Aucune métadonnée de build versionnée n'est actuellement exposée au
  navigateur. Le rapport affiche `non disponible` pour la version/build tant
  qu'aucune valeur sûre et réellement disponible n'est fournie ; aucune valeur
  n'est inventée.
- La position exacte de l'aperçu (avant ou après la copie) est laissée à
  l'implémentation. L'aperçu doit être atteignable par une action utilisateur
  et le rapport n'est calculé qu'à ce clic, puis recalculé à chaque copie.
- Les suggestions de vérification non destructive sont des constats et des
  liens vers les contrôles existants ; elles ne promettent aucune récupération
  et ne sont pas des actions automatiques.
- Le masquage par défaut de l'origine Cloud est retenu. Aucun mode de partage
  brut n'est ajouté, même caché.
- La preuve d'un comportement réel sur Chrome Android et Dexie Cloud reste une
  recette manuelle séparée ; la CI ne prouve que les modèles, le DOM et les
  tests simulés.
