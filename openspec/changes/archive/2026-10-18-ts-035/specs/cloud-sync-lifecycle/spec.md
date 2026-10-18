# Spec Delta

## ADDED Requirements

### Requirement: Repair convergence evidence

Une réparation de workspace SHALL distinguer le commit IndexedDB local, l'envoi natif, le pull distant et la lecture métier réussie. Un commit local, un signal `in-sync` générique ou une transaction unique MUST NOT suffire à déclarer la réparation achevée sur le serveur ou sur un autre appareil. La convergence inter-appareils SHALL rester une preuve de recette séparée.

#### Scenario: Local repair commit is not a remote completion
- **WHEN** une transaction de réparation IndexedDB réussit
- **THEN** l'application indique que la réparation est enregistrée localement
- **AND** elle indique la synchronisation comme en attente ou indéterminée
- **AND** elle n'annonce ni push distant ni convergence inter-appareils

#### Scenario: In-sync alone is not convergence
- **GIVEN** un commit local de réparation
- **WHEN** un état natif `in-sync` est observé sans nouvelle lecture métier réussie
- **THEN** la convergence n'est pas déclarée sur cet appareil
- **AND** le statut reste en attente ou indéterminé

#### Scenario: Native pull plus successful business read
- **GIVEN** un commit local de réparation
- **WHEN** le pull natif est prouvé et une lecture métier fraîche relit les enregistrements réparés
- **THEN** l'application peut indiquer que la réparation a convergé sur cet appareil
- **AND** elle ne prétend pas prouver la convergence sur un autre appareil

#### Scenario: Later synchronization error preserves local evidence
- **WHEN** le commit local a réussi puis la synchronisation distante échoue
- **THEN** la réparation reste enregistrée localement
- **AND** l'erreur de synchronisation est signalée séparément
- **AND** aucune conclusion de convergence n'est produite

#### Scenario: Cross-device convergence requires separate evidence
- **WHEN** un deuxième navigateur doit afficher le workspace réparé
- **THEN** la convergence est vérifiée sur une instance réelle et un second appareil
- **AND** elle n'est pas déduite d'un commit local ou d'un état `in-sync` sur le premier appareil
