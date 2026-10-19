# Proposal

## Why

ThreadStep affiche aujourd'hui ses commandes métier dans l'en-tête de
l'accueil et ne dispose que de la route `#/sujet/<id>`. Il n'existe aucun point
d'entrée stable vers des paramètres, et ajouter demain les pages Imports /
Exports et Synchronisation sans structure de navigation encombrerait l'accueil
ou casserait la navigation des projets. TS-041 fournit un menu accessible et des
routes stables pour préparer TS-042 et TS-043 sans déplacer leurs contrôles.

## What Changes

- Ajouter dans l'en-tête un bouton natif « Menu » de type hamburger, visible et
  utilisable sur mobile comme sur ordinateur, avec `aria-expanded`,
  `aria-controls` et un panneau de navigation masqué hors ouverture.
- Le panneau contient exactement « Mes projets », « Paramètres »,
  « Imports / Exports » et « Synchronisation Dexie Cloud », sous forme de liens
  vers des fragments relatifs.
- Étendre les fonctions pures de routage avec `#/parametres`,
  `#/parametres/donnees` et `#/parametres/synchronisation`, sans modifier le
  comportement de `#/sujet/<id>`.
- Ajouter une structure de pages de paramètres avec titres explicites,
  navigation retour et sections descriptives pour les futurs emplacements de
  TS-042 et TS-043. Les contrôles métier existants (`#export`, `#import`,
  `#restore`, `#restore-panel`), la connexion, la configuration Cloud et le
  diagnostic restent à leur emplacement actuel.
- Fermer le menu après navigation, par Échap et par clic extérieur pertinent ;
  retourner le focus au déclencheur lors d'une fermeture sans navigation.
- Garantir qu'un changement de route ou l'ouverture/fermeture du menu est une
  opération de présentation : aucune ouverture/réinitialisation Dexie, requête
  réseau, authentification ni mutation métier n'est déclenchée.

## Capabilities

### New Capabilities

- `app-navigation`: menu de navigation principal, routes de paramètres stables,
  structure des pages de paramètres et garanties de navigation sans effet de
  bord sur les données et la synchronisation.

### Modified Capabilities

Aucune. Le comportement de `subject-detail-view` reste inchangé : la route
`#/sujet/<id>`, le retour, l'historique et le repli accessible sont préservés et
seulement rejoints par de nouvelles routes de paramètres.

## Impact

- `site/index.html` : bouton Menu, panneau de navigation, sections de paramètres.
- `site/styles.css` : présentation du menu hamburger, du panneau et des pages de
  paramètres, y compris à 320 px.
- `site/core.js` : extension pure de `parseRoute`/`isViewEntry` et fonctions
  pures de libellés, de cible de focus et d'état du menu.
- `site/app.js` : câblage du menu, visibilité des pages de paramètres et gestion
  du focus lors des changements de route.
- `tests/` : tests déterministes des routes et de l'état du menu, plus
  assertions statiques sur le DOM, les sélecteurs préservés et l'absence
  d'effets Dexie/réseau/mutation dans la navigation.
- `docs/product/guide-utilisation.md` et
  `docs/product/acceptance-checklist.md` : description de la navigation livrée.
- Aucun changement de schéma, de format d'import/export, de configuration Cloud,
  de secret ni de workflow.

## Non-Goals

- Déplacer ou activer les formulaires d'import/export et de restauration
  (TS-042), ou transformer `#sync-diagnostic` en page de diagnostic (TS-043).
- Modifier les contrôles de sauvegarde, connexion, activation, purge ou
  diagnostic, ni leur visibilité conditionnelle existante.
- Créer un routeur tiers, un serveur, une route sans hash ou une nouvelle
  dépendance.
- Modifier les données, les préférences, les clés de stockage ou le document
  exporté.
- Ajouter des identifiants sensibles, des paramètres secrets ou des routes
  propres à un compte dans les URL.

## Uncertainties and decisions

- **Route inconnue.** `parseRoute` renvoie actuellement la vue d'ensemble pour
  un fragment non reconnu. TS-041 ne crée pas de page « 404 » : ce repli
  déterministe est conservé, sans exception, sans écriture et sans rendre
  visible un panneau normalement masqué. Une page introuvable dédiée serait une
  décision produit distincte.
- **Barre d'actions existante sur les pages de paramètres.** Pour ne pas
  déplacer les contrôles avant TS-042, la barre `#business-tools` et les
  panneaux Cloud/diagnostic restent à leur emplacement actuel, même lorsqu'une
  page de paramètres est affichée. Seul le tableau de bord « Mes projets » est
  remplacé par la page de paramètres active.
- **Profondeur des pages de paramètres.** TS-041 pose des titres, retours et
  sections descriptives. Les emplacements détaillés « Configuration »,
  « Première activation », « Connexion » et « Espaces de travail » relèvent de
  TS-043 et ne sont pas anticipés ici.
- **Focus après navigation.** Le bouton Menu reste le déclencheur ; Échap
  restaure explicitement le focus dessus. Une navigation par lien ferme le menu
  et place le focus sur le titre de la page de destination, sans inventer de
  gestion de focus propre à TS-042/TS-043.
