# Design

## Context

Voir `proposal.md` pour la motivation. Dans l'état livré, `applySyncSummaryVisibility()`
utilise `buildDiagnosticSummary()` pour décider si `#sync-summary` et
`#sync-settings-access` sont visibles sur `#/`. Ce modèle considère comme
« attention » toute session non authentifiée, connexion non connectée, phase
différente de `in-sync` et pull initial non terminé, ce qui expose des états
ordinaires de restauration. `applyBusinessVisibility()` masque déjà `#dashboard`
si un espace Cloud n'est pas autorisé ou si `documentLoaded` est faux, et
`clearBusinessForBindingBlock()` vide la vue en cas de liaison bloquée. Le
rendu peut toutefois afficher le message de liste vide, le compteur ou la
suggestion alors qu'aucune lecture métier n'a abouti, notamment après une
navigation pendant le chargement.

Les specs `cloud-sync-lifecycle`, `cloud-settings-hub`,
`workspace-identity-isolation` et `ux-interaction-continuity` restent les
contrats de référence. Le diagnostic détaillé de
`#/parametres/synchronisation` et ses commandes OTP, pull et récupération ne
doivent pas changer.

## Goals / Non-Goals

**Goals:**

- Isoler dans un modèle pur les quatre états de présentation de Mes projets et
  les décisions de chargement, de résumé et de lien.
- Supprimer les alertes et le chargement parasites pendant une restauration
  saine, tout en expliquant les erreurs confirmées, les blocages et les
  attentes durables.
- Conserver la liste et les états de vue pendant les synchronisations de fond
  sous la même identité autorisée.
- Rendre les temporisations annulables, bornées et testables sans effet sur la
  lecture, l'autorisation, la preuve distante ou les données.

**Non-Goals:**

- Modifier la synchronisation Dexie, l'authentification, la liaison de compte,
  la récupération, la purge, le schéma, l'export/import ou les workflows ASF.
- Modifier le diagnostic détaillé ou déplacer ses contrôles.
- Introduire une persistance, un cache ou un nouvel abonnement natif.
- Résoudre les incidents de fond de session OTP ou de récupération traités par
  TS-045/TS-048.

## Decisions

### 1. Un modèle pur séparé décide de la présentation de Mes projets

Créer `site/overview-read-state.js` avec des états exportés
(`initializing`, `awaiting-read`, `available`, `action-required`), des seuils
de présentation et une fonction pure `buildOverviewReadPresentation(input)`.
Elle reçoit uniquement des signaux déjà disponibles : espace configuré, état de
session, liaison de compte, démarrage et résultat de la lecture, erreurs
catégorisées, `documentLoaded` et temps écoulé injecté. Elle ne lit ni DOM, ni
stockage, ni réseau, et ne programme aucun timer.

La disponibilité des projets vaut `documentLoaded === true` sous une liaison et
une session autorisées. Elle ne dépend jamais de `in-sync`, de
`initialPull === complete`, de `navigator.onLine` ou d'un délai. Les transitions
`loading`, `connecting`, `initial`, `pulling`, `pushing`, `not-in-sync` et le
pull en attente restent des signaux natifs sans effet d'alerte tant qu'aucune
erreur confirmée ni attente durable n'est constatée.

*Alternative écartée :* modifier `buildDiagnosticSummary()` pour changer son
`needsAttention`. Cela mélangerait la synthèse du diagnostic détaillé et la
décision d'alerte de l'accueil, et ferait perdre la description complète des
états sur la page Synchronisation.

### 2. La page de diagnostic garde son modèle actuel

`buildDiagnosticSummary()` continue d'alimenter la synthèse de la page
`#/parametres/synchronisation`. Seul l'accueil cesse de l'utiliser comme
décision d'alerte. Le diagnostic détaillé, ses libellés, ses erreurs classées,
ses abonnements et le bouton de relance restent inchangés.

`overviewAccessLinkVisible()` peut rester le helper de visibilité du lien, mais
reçoit désormais la décision `actionRequired` du nouveau modèle plutôt que le
`needsAttention` de la synthèse diagnostique. Une activation suspendue ou
annulée reste un motif d'action explicite.

### 3. Une seule région de chargement remplace la fausse liste

Ajouter dans `#dashboard`, immédiatement avant `#subjects`, une zone
`#projects-loading` masquée par défaut, avec `role="status"`,
`aria-live="polite"`, `aria-busy="true"` lorsqu'elle est active et le texte
« Chargement de vos projets… ». Elle est compacte, non focalisable et sans
animation obligatoire ; `prefers-reduced-motion` n'impose aucun mouvement.

Quand l'état est `awaiting-read`, la zone de chargement est visible, la liste,
le compteur, les suggestion/résumé de reprise et le formulaire d'ajout sont
masqués pour ne pas présenter un `0 projet` ou une action inopérante. Quand
l'état est `available`, le chargement est masqué et le rendu existant réaffiche
la liste avec `replaceSubjectsInCurrentView()` et les mécanismes de continuité
TS-049/TS-050. Quand une action est requise sans projets, le chargement n'est
pas laissé seul : le résumé persistant et le lien expliquent la suite. Quand une
action est requise alors que des projets sont déjà disponibles, la liste reste
affichée et le résumé s'ajoute sans la remplacer.

`applyBusinessVisibility()` conserve son garde-fou : la liste métier n'est
jamais montrée sans autorisation de liaison et sans lecture aboutie. Il est
seulement complété pour laisser apparaître la région de chargement ou le
résumé d'action sur la route d'ensemble, sans affaiblir le masquage d'un cache
non vérifié, d'un autre compte ou d'un espace non autorisé.

*Alternative écartée :* placer le chargement hors du tableau de bord et laisser
`#dashboard` entièrement masqué. Cela séparerait le chargement de l'emplacement
réel de la liste et rendrait les transitions de hauteur moins prévisibles.

### 4. Deux seuils déterministes, uniquement de présentation

Le modèle expose des constantes nommées et testées :

- `OVERVIEW_LOADER_DELAY_MS = 250` : évite un flash de chargement lorsqu'une
  lecture très rapide aboutit ;
- `OVERVIEW_DURABLE_WAIT_MS = 8000` : transforme une attente prolongée en aide
  persistante au lieu d'un loader sans fin.

Un adaptateur dans `site/app.js` conserve une génération de présentation, un
horodatage de début et un seul timer. Il annule et nettoie le timer à chaque
résolution, erreur, changement de route, changement d'espace ou de liaison,
rechargement ou nouveau calcul. Le callback vérifie la génération et l'identité
autorisée avant de modifier le DOM. Une erreur confirmée est appliquée
immédiatement, sans attendre le seuil.

Aucun callback ne lance de lecture, ne modifie l'autorisation, ne crée de preuve
distante et ne réutilise un résultat d'un autre espace. Un timer échu alors que
la route ou l'identité a changé est ignoré.

*Alternatives écartées :* afficher le chargement sans délai (flash possible sur
les lectures rapides) ou utiliser un timeout pour décider que la lecture est
autorisée ou terminée (contournerait les frontières de sécurité).

### 5. Les annonces sont dédupliquées par clé d'état

L'adaptateur calcule une clé stable à partir de l'état, du motif d'action et du
texte. Il ne réécrit `textContent` et les attributs `aria-busy`/`hidden` que si
la clé ou la valeur change réellement. Le chargement n'annonce qu'une fois son
apparition ; le résumé d'action n'est annoncé que lorsqu'il devient visible ou
que son motif change. Les recalculs natifs identiques ne produisent donc pas
d'annonces répétées.

Le chargement n'est jamais focalisable et ne déplace ni le focus ni le
défilement. Le retour à la liste réutilise le rendu atomique et l'ancrage
existants. Les groupes développés restent en mémoire selon TS-050 ; seul un
changement effectif d'identité autorisée conserve l'exception de réinitialisation
prévue par `ux-interaction-continuity`.

### 6. La priorité des états protège les erreurs et l'isolation

Ordre de décision retenu :

1. erreur confirmée de lecture/stockage, session expirée ou refusée, liaison
   `UNVERIFIED`, `MISMATCH` ou destination différente : `action-required`
   immédiat ;
2. projets chargés sous session et liaison autorisées : `available` ;
3. lecture autorisée en cours : `awaiting-read`, puis `action-required` pour
   attente durable au-delà du seuil ;
4. sinon : `initializing`, sans alerte.

Une session `loading` et une liaison `indeterminate` restent `initializing`
jusqu'à preuve contraire ; elles ne deviennent une action qu'après une erreur
confirmée ou le seuil d'attente durable. Un espace local autonome suit le même
cycle avec une lecture toujours autorisée. Un espace non autorisé ne passe
jamais à `available` pour conserver une liste existante.

## Risks / Trade-offs

- [Une erreur réelle serait classée comme initialisation transitoire] →
  Priorité explicite aux erreurs confirmées, tests couvrant chaque catégorie,
  et aucun timeout ne peut retarder l'affichage d'une erreur.
- [Un délai trop court produit encore un flash, ou un délai trop long inquiète]
  → Seuils nommés, centralisés et testés ; la recette manuelle Android/desktop
  peut ajuster la valeur sans changer le contrat observable.
- [Le chargement ou le résumé provoque un saut de hauteur] → Zone compacte et
  stable, liste masquée uniquement pendant l'attente, remplacement atomique
  existant et aucune animation imposée.
- [Une annonce `aria-live` se répète à chaque événement natif] → Clé d'état
  dédupliquée et tests de rendus répétés.
- [La liste reste visible alors que l'identité a changé] → `available` exige la
  liaison et la session autorisées ; les blocages existants vident la vue et
  aucun document d'un autre espace n'est réutilisé.
- [Les tests existants supposent l'ancienne visibilité d'alerte] → Mise à jour
  ciblée des assertions d'accueil, sans modifier les attentes du diagnostic
  détaillé ni le comportement du bouton de relance.

## Migration Plan

Aucune migration de données, de schéma, d'export ou de préférence. Le changement
est une évolution de présentation réversible : retirer le module, la région de
chargement, son câblage et les styles suffit à revenir au comportement
antérieur. Aucun déploiement Cloud, secret ou configuration Dexie n'est requis.
Rollback par revert de la PR sans opération utilisateur.

## Open Questions

Aucune question bloquante. Le libellé français exact de l'aide d'action et
l'ajustement visuel des seuils peuvent être affinés pendant `apply` sans changer
les specs, les états ou la découpe des tâches.
