# Design

## Context

Voir `proposal.md` pour le problème et la valeur attendue. Dans l'état livré,
`load()` réinitialise `expandedParents` et `openMenuId`, puis délègue à
`refreshSyncedDocument()` ou `refreshLocalDocument()`. `load()` n'est appelé
que par deux sources asynchrones : la fin de synchronisation Dexie Cloud et les
messages du `BroadcastChannel`. Les mutations locales appellent directement
`render()`, mais la lecture Dexie Cloud qui suit peut aussi passer par cette
frontière. Les entrées de vue sont déjà traitées séparément par `hashchange`
via `isViewEntry()`, et l'import local réinitialise l'état avant même que la
prévisualisation soit acceptée.

Le contrat `ux-interaction-continuity` précise que les rafraîchissements de
données et les événements inter-onglets ne sont pas des navigations. La spec
`substep-collapse` précise déjà les réinitialisations attendues lors d'une
entrée de vue, d'un rechargement, d'un nouvel onglet et d'un import. Le code
doit donc se conformer à ces règles, sans ajouter de persistance.

## Goals / Non-Goals

**Goals:**

- Un rafraîchissement de données dans la vue courante et sous la même identité
  autorisée ne modifie jamais `expandedParents` ni le focus de repli en attente.
- Les seules réinitialisations de l'expansion sont les frontières observables :
  entrée dans une nouvelle vue (y compris Précédent/Suivant), chargement réel,
  nouvel onglet, import réussi et changement effectif d'espace/identité.
- Le filtre des éléments terminés continue de masquer les sous-tâches et de
  retirer le contrôle d'un parent sans enfant visible, sans toucher aux autres
  parents.
- L'état reste en mémoire uniquement ; aucune clé, aucun champ de document ni
  aucune écriture localStorage n'est ajouté.

**Non-Goals:**

- Modifier le modèle de document, l'export/import, la synchronisation, la
  liaison de compte ou la politique de sélection d'espace.
- Conserver l'expansion après une navigation, un rechargement, un nouvel onglet
  ou un import réussi.
- Corriger les défauts de bootstrap de TS-045/TS-048 ou modifier leurs
  mécanismes de reprise.

## Decisions

### 1. `load()` redevient un rafraîchissement sans réinitialisation d'expansion

`load()` conserve son rôle de point d'entrée des événements asynchrones, mais ne
remet plus `expandedParents` à zéro. Il continue de réinitialiser les états dont
la fermeture est déjà attendue sur un rafraîchissement (par exemple le menu
ouvert), afin de ne pas élargir le changement au-delà de TS-050.

Une fonction dédiée, par exemple `resetExpandedViewState()`, regroupe la remise
à zéro de `expandedParents` et des focus de repli associés. Elle est appelée
uniquement par les frontières explicites, jamais par le chemin de
rafraîchissement.

*Alternative écartée :* retirer complètement `load()` et appeler directement
`refreshSyncedDocument()`/`refreshLocalDocument()`. Cela rendrait les tests et
les abonnements moins lisibles et mélangerait la correction TS-050 avec une
refonte des événements.

### 2. Une frontière d'identité de vue protège contre les changements de compte

L'application mémorise en mémoire une clé d'espace autorisé, composée du type
d'espace effectif et, en Cloud, du nom de base et du digest d'utilisateur
autorisé déjà disponible dans la liaison. Quand une vue redevient autorisée,
une clé différente de la précédente réinitialise l'expansion avant le rendu.
Une simple réévaluation de liaison, une lecture asynchrone ou un état
temporairement masqué sous la même identité ne change pas la clé et ne replie
donc pas les groupes.

Le helper de comparaison peut être pur et testé dans
`site/interaction-continuity.js`, sans lecture DOM ni persistance. La clé reste
strictement en mémoire et n'est jamais exportée ni journalisée.

*Alternatives écartées :* réinitialiser à chaque incrément de
`bindingGeneration` (trop fréquent, y compris pour une même identité) ou à
chaque passage de `businessAllowed()` à `false` (une reprise transitoire
replierait les groupes alors que l'identité n'a pas changé). Le masquage des
données en cas d'espace non autorisé reste assuré par les contrôles existants ;
la clé ne sert qu'à empêcher la réutilisation d'un état d'expansion d'un autre
espace après réautorisation.

### 3. L'import réinitialise après réussite, pas à la prévisualisation

Pour l'import local, la remise à zéro quitte le gestionnaire `change` et rejoint
le chemin de confirmation après une fusion réussie ou un import reconnu comme
déjà appliqué. Une prévisualisation annulée, un refus de consentement, une
collision ou un échec de transaction ne modifie donc pas l'expansion.

Pour l'import JSON réconcilié côté Cloud, la même réinitialisation est appliquée
après une réconciliation localement écrite ou reconnue comme déjà à jour, sans
toucher aux échecs, plans périmés ou refus. Le rechargement de données qui suit
reste un rafraîchissement ordinaire.

*Alternative écartée :* conserver la remise à zéro au début du gestionnaire de
fichier ; cela violerait le scénario « import réussi » et replierait les groupes
avant même que l'utilisateur confirme.

### 4. L'expansion est conservée telle quelle, sans purge des identifiants

Un parent supprimé ou dont tous les enfants sont filtrés n'a plus de contrôle
visible. Son identifiant peut rester dans l'ensemble en mémoire sans effet
observable ; les autres parents gardent leur état. Aucun nettoyage opportuniste
ne doit modifier l'ensemble pendant un rafraîchissement, car il pourrait
replier un parent dont la sous-tâche est momentanément filtrée puis réaffichée
dans la même vue.

### 5. Accessibilité, focus et scroll restent gérés par le rendu existant

Le rendu reconstruit `aria-expanded`, `aria-controls` et les listes visibles à
partir du même ensemble conservé. Les mécanismes de continuité TS-049
(ancrage, focus, restauration) restent inchangés et s'appliquent après le
rafraîchissement. Une entrée de vue réinitialise l'expansion avant le rendu et
suit la politique de focus de navigation existante.

## Risks / Trade-offs

- **Un rafraîchissement tardif sous une ancienne identité pourrait réutiliser
  l'ensemble courant** → Les lectures Cloud vérifient déjà l'autorisation avec
  `stillAuthorized`; la clé d'espace autorisé est comparée avant de rendre le
  nouvel état.
- **Un espace non autorisé pourrait laisser croire à une continuité** → Le
  masquage métier existant prévaut ; la clé d'espace force une réinitialisation
  dès qu'un espace autorisé différent est affiché.
- **Un parent supprimé puis recréé avec le même identifiant resterait ouvert**
  → Les identifiants sont générés aléatoirement et un import réinitialise
  l'état ; le risque est jugé négligeable et préférable à une purge qui
  replierait des parents filtrés.
- **Déplacer la réinitialisation d'import peut changer le comportement d'une
  prévisualisation annulée** → C'est le comportement demandé : seule une entrée
  ou un import réussi réinitialise. Des tests couvrent annulation, échec et
  succès.
- **Coordination TS-045/TS-048** → Ne pas modifier leurs protections de
  liaison ; limiter les changements à la frontière d'affichage et vérifier
  qu'une reprise de lecture sous la même identité ne réinitialise pas
  l'expansion.

## Migration Plan

Aucune migration de données. Déploiement statique normal. En cas de régression,
revenir au commit précédent : aucun stockage ni format n'a été modifié, donc un
retour arrière ne perd aucune donnée utilisateur.

## Open Questions

Aucune question bloquante. La recette réelle mobile/Cloud et la coordination
temporelle avec TS-045/TS-048 restent des incertitudes de validation, pas des
choix de produit à trancher dans ce plan.
