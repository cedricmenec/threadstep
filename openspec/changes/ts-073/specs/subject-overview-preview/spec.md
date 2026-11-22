## REMOVED Requirements

### Requirement: Overview top-level preview limit

**Reason**: L’overview n’affiche plus de lignes de tâches.
**Migration**: La liste complète et ses règles de visibilité sont consultables dans la vue de détail du projet.

### Requirement: « Voir plus » opens the full detail

**Reason**: La commande « Voir plus » n’est plus utile en l’absence d’aperçu de tâches.
**Migration**: L’activation de la carte projet ouvre directement le détail complet.

### Requirement: Hidden preview entries are unreachable

**Reason**: Aucun aperçu de tâche ni cible de réordonnancement n’est présent dans l’overview.
**Migration**: Toutes les tâches restent gérées selon les contrats de la vue de détail.

### Requirement: Presentation-only preview

**Reason**: Le calcul de preview est retiré de la surface Overview.
**Migration**: Les compteurs de carte sont dérivés du document complet sans modifier les données.

### Requirement: Accessible « Voir plus » control

**Reason**: Il n’existe plus de commande « Voir plus ».
**Migration**: La carte projet elle-même est une commande de navigation accessible vers le détail.
