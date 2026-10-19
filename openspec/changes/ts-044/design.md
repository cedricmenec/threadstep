# Design

## Context

TS-043 a livré sur `#/parametres/synchronisation` un diagnostic en lecture seule
et quatre emplacements descriptifs. Les contrôles réels (`#cloud-config`,
`#cloud-activation`, `#auth-panel`, `#workspace-panel`) restent actuellement
hors de cette page, au niveau du document principal. Cette séparation est la
contradiction que TS-044 doit résoudre.

Les modules métier existants restent la source de vérité : configuration URL
(`dexie-foundation.js`), activation (`cloud-activation.js`),
authentification (`authentication.js`), espaces (`workspace-identity.js`),
diagnostic (`sync-diagnostics.js`) et réconciliation
(`migration-reconciliation.js`). `site/app.js` conserve déjà les handlers et
les identifiants DOM. Le déplacement ne doit donc pas recréer de formulaires ni
de logique.

## Goals / Non-Goals

**Goals:**

- Un lieu unique et compréhensible pour configurer, activer, se connecter,
  choisir un espace, diagnostiquer et agir sur la copie locale.
- Une continuité d'état entre les routes : un OTP en cours, une revue
  d'activation, une erreur ou un consentement affiché ne doivent pas être
  réinitialisés par une simple navigation.
- Un accès contextuel depuis Mes projets quand une action est réellement
  nécessaire, sans action implicite.
- Des tests déterministes prouvant le déplacement, la visibilité par route et
  la séparation des actions.

**Non-Goals:**

- Réécrire les algorithmes d'authentification, d'activation, de
  réconciliation, de synchronisation ou de purge.
- Ajouter un état métier persistant pour l'onboarding ou une nouvelle machine
  de synchronisation.
- Modifier le schéma IndexedDB, le format de sauvegarde ou les workflows ASF.
- Prouver en CI une connexion réelle à Dexie Cloud ou une purge réelle.

## Decisions

### 1. Déplacement statique des nœuds DOM existants

Les sections `#cloud-config`, `#cloud-activation`, `#auth-panel` et
`#workspace-panel` sont déplacées, une seule fois, à l'intérieur de
`#settings-sync-page`, dans des conteneurs nommés :

1. onboarding contextuel ;
2. `Configuration` (contient `#cloud-config`) ;
3. `Première activation` (contient `#cloud-activation`) ;
4. `Connexion` (contient `#auth-panel`) ;
5. `Espaces de travail` (contient `#workspace-panel`) ;
6. diagnostic (`#sync-diagnostic`).

Les identifiants, formulaires, boutons, handlers et messages existants sont
conservés. Aucun nœud n'est dupliqué ni recréé au moment de la navigation.

*Alternative rejetée :* re-parentage dynamique en JavaScript. Il complique le
cycle de vie, masque les erreurs de duplication et rend les tests statiques
fragiles.

### 2. Visibilité par route sans réinitialisation

`applySettingsVisibility` continue de masquer les pages de paramètres hors
route. La page parente masque les quatre panneaux intégrés, tandis que chaque
panneau conserve ses propres attributs `hidden` calculés par ses fonctions
existantes. Les champs et interactions restent donc dans le DOM, avec leur
état mémoire (`authInteraction`, `activationContext`, erreurs, consentement).

La navigation ne fait que basculer `hidden` et le focus ; elle n'appelle ni
`setupAuthentication`, ni `bootstrapSyncedDatabase`, ni `db.open()`,
`db.cloud.configure()`, ni une réinitialisation de `authController`.

*Alternative rejetée :* reconstruire les panneaux à chaque entrée de route.
Cela détruirait un OTP en cours et pourrait déclencher des effets de bord.

### 3. Onboarding dérivé, sans nouvel état métier

Un petit module de présentation pur, `site/cloud-settings.js`, expose des
libellés et une sélection d'étape à partir des observables déjà disponibles :
URL configurée, étape d'activation, statut OTP/session, première lecture
distante, présence d'un plan, statut de premier transfert, diagnostic et
classification de cible.

L'étape affichée est la plus avancée réellement attestée, sinon l'étape
suivante autorisée. Le module ne lit ni n'écrit IndexedDB, ne contacte pas le
service et ne décide d'aucune mutation. Il ne remplace pas
`transitionActivation`.

*Alternative rejetée :* créer une seconde machine à états d'onboarding. Elle
divergerait des protections TS-035 à TS-040 et du diagnostic natif.

### 4. Lien d'accès contextuel depuis Mes projets

Le résumé `#sync-summary` reste un statut non interactif. Un lien distinct,
`#sync-settings-access`, est ajouté à côté de lui et pointe vers
`#/parametres/synchronisation`. Sa visibilité est dérivée du même diagnostic :

- visible lorsqu'un espace Cloud configuré nécessite une action (session,
  connexion, pull initial, erreur, écriture en attente, espace bloqué) ou
  qu'une activation suspendue/échouée doit être reprise ;
- masqué pour un local non configuré sain et pour une synchronisation
  configurée entièrement en phase.

Le lien ne déclenche ni OTP, ni pull, ni activation, ni purge. Un clic est une
navigation de présentation soumise aux mêmes garanties que le menu.

*Alternative rejetée :* rendre le résumé cliquable ou y ajouter un bouton de
relance. Cela changerait sa sémantique non interactive et la protection TS-043.

### 5. Actions destructives inchangées et réutilisées

`#workspace-panel` conserve ses quatre actions indépendantes et ses handlers :

- « Sélectionner cet espace » pour changer d'espace ;
- « Suspendre Cloud » ;
- « Se déconnecter » ;
- « Purger la copie locale ».

Les textes de portée continuent d'afficher l'URL, la base locale effective et
l'avertissement sur les changements non synchronisés. Les confirmations, la
sauvegarde JSON et l'annulation restent celles du module existant. Aucun
nouveau bouton global n'est introduit.

### 6. Ordre et accessibilité

Les conteneurs de section utilisent des titres visibles et des libellés
français. Le diagnostic conserve ses zones `aria-live`, son bouton de relance et
sa raison de désactivation. Les nouveaux liens et conteneurs respectent une
cible de 44 px et l'absence de débordement horizontal à 320 px.

## Risks / Trade-offs

- **Un panneau requis devient invisible sur Mes projets pendant une session
  bloquée** → L'accès contextuel et le menu restent disponibles ; la page de
  synchronisation ouvre le panneau concerné et l'état d'OTP est préservé.
- **Des tests TS-041/TS-043 affirment encore que les contrôles sont hors de la
  page** → Ces attentes sont explicitement mises à jour dans la même tâche,
  avec de nouveaux tests d'unicité et de visibilité.
- **Un OTP en cours est interrompu par une navigation** → Aucun handler
  d'annulation n'est appelé au changement de route ; les éléments DOM restent
  en place et un test statique interdit les appels de réinitialisation dans les
  chemins de navigation.
- **Le formulaire de configuration est déjà masqué lorsqu'une URL existe** →
  Comportement existant conservé ; la section reste présente et les autres
  étapes attestées prennent le relais.
- **Une erreur réseau réelle ne peut pas être prouvée en CI** → Les scénarios
  déterministes couvrent les états simulés ; la recette réelle reste en Manual
  acceptance et n'est jamais présentée comme réussie par les tests.

## Migration Plan

1. Ajouter le module de présentation pur et ses tests.
2. Déplacer le markup sans changer les identifiants ni les handlers.
3. Brancher la visibilité par route et l'accès contextuel ; vérifier qu'aucun
   appel d'ouverture, de configuration, d'authentification ou de mutation n'est
   ajouté aux chemins de navigation.
4. Adapter les styles, les tests existants et la documentation produit.
5. Exécuter `npm run check` et `openspec validate ts-044 --strict`.
6. Recette manuelle réelle séparée, puis sync/archive/PR/CI selon le workflow.

Aucun rollback de données n'est nécessaire : le changement est une présentation
qui ne touche ni aux bases, ni aux formats, ni aux consentements persistés.
