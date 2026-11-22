# Spec Delta

## MODIFIED Requirements

### Requirement: Stitch affordances are static and truthful

Les contrôles ou valeurs Stitch sans donnée ou comportement métier SHALL être omis de la page détail. Les informations conservées MUST être issues des données et règles existantes. Les commandes de date ou calendrier non prises en charge dans les lignes de tâche SHALL rester nativement désactivées et sans effet.

#### Scenario: Recherche, filtres et tri désactivés
- **GIVEN** la page détail ne fournit aucune recherche ou tri de projet opérationnel
- **WHEN** la page détail est rendue
- **THEN** aucun champ de recherche, filtre d'état ou tri factice n'est présenté
- **AND** le sélecteur de projet et le filtre actif des tâches terminées restent utilisables

#### Scenario: Échéance et calendrier sans effet
- **GIVEN** une tâche est affichée à côté d'un élément Stitch d'échéance ou de calendrier
- **WHEN** cet élément est activé ou reçoit une date
- **THEN** aucune date n'est enregistrée et aucun calendrier ou sélecteur actif n'est ouvert
- **AND** la tâche et ses exports restent inchangés

#### Scenario: Métadonnées absentes sans donnée fictive
- **GIVEN** le détail du projet ne contient pas de description, catégorie, code ou couverture
- **WHEN** le projet est affiché
- **THEN** aucun bloc de métadonnées ou valeur d'exemple n'est présenté comme une information du projet

#### Scenario: Partage et archivage désactivés
- **GIVEN** ThreadStep ne fournit pas de commandes de partage ou d'archivage
- **WHEN** le détail est affiché
- **THEN** aucune action de partage ou d'archivage factice n'est présentée
- **AND** aucun partage, archivage, changement de route ou écriture ne peut en résulter

#### Scenario: Panneau de projet sans activité simulée
- **GIVEN** le projet fournit une progression calculable et des tâches existantes
- **WHEN** le détail affiche son résumé
- **THEN** la progression et la prochaine tâche proviennent des données actuelles du projet
- **AND** aucune activité ni métrique de démonstration n'est présentée
- **AND** toute information sans source métier est omise
