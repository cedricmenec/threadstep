# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Surface React dormante et interface existante inchangée`
- TO: `### Requirement: Surface React activée uniquement sur le détail projet`

## MODIFIED Requirements

### Requirement: Surface React activée uniquement sur le détail projet

La surface React métier SHALL être activée uniquement pour la vue détail d'un
projet `#/sujet/:id`, dans le conteneur borné cédé par le contrôleur existant.
Overview, Paramètres, Imports / Exports et Synchronisation MUST rester ceux du
rendu vanilla livré. L'activation MUST NOT créer de préférence persistée, de
route, de clé de stockage ou de transfert de données. Le retour au vanilla SHALL
démonter ou invalider la racine avant le rendu suivant.

#### Scenario: Aucune activation prématurée

- **GIVEN** l'application livrée par ce changement
- **WHEN** les routes existantes sont ouvertes
- **THEN** seule la route `#/sujet/<id>` valide monte la surface React du détail
- **AND** Overview, Paramètres, Imports / Exports et Synchronisation restent
  ceux du rendu vanilla actuel

#### Scenario: URLs et fragments inchangés

- **WHEN** les routes `#/`, `#/parametres`, `#/parametres/donnees`,
  `#/parametres/synchronisation` et `#/sujet/<id>` sont exercées
- **THEN** leur interprétation, leur chargement direct et leur rafraîchissement restent inchangés
- **AND** aucune nouvelle route ou préférence persistée n'est créée

#### Scenario: Bascule réversible sans données

- **GIVEN** une surface React active sur le détail d'un projet
- **WHEN** la surface est démontée ou invalidée et que le vanilla reprend le
  rendu, notamment vers Overview ou une page de paramètres
- **THEN** aucun stockage local, aucune préférence, aucune route et aucune
  donnée métier ne sont créés ou modifiés par la bascule
- **AND** la racine React ne possède plus le conteneur
