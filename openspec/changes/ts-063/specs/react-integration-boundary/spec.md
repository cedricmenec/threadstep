# react-integration-boundary Specification Delta

## MODIFIED Requirements

### Requirement: Propriété DOM unique et bornée

Au plus une racine React SHALL posséder un même conteneur borné à la fois.
Pendant ce changement, l'application MAY avoir exactement deux conteneurs
bornés simultanément — l'en-tête et la surface détail — chacun avec un
propriétaire exclusif. Tant qu'une racine est active, le renderer vanilla MUST
NOT remplacer ni modifier ses descendants. Avant un nouveau rendu vanilla, la
racine correspondante SHALL être démontée. Plusieurs cycles de navigation et de
rafraîchissement MUST NOT cumuler des racines ni laisser des listeners actifs
dupliqués.

#### Scenario: Montage puis démontage

- **GIVEN** un conteneur borné et une fixture React synthétique
- **WHEN** la racine est montée puis démontée
- **THEN** le conteneur ne contient plus d'arbre React après le démontage
- **AND** aucun listener actif de la fixture ne subsiste
- **AND** seul ce conteneur est libéré

#### Scenario: Le vanilla ne possède pas le conteneur actif

- **GIVEN** une racine React active dans son conteneur
- **WHEN** le renderer vanilla tente de remplacer les descendants du conteneur
- **THEN** l'écriture est refusée
- **AND** l'arbre React et son propriétaire restent uniques

#### Scenario: Cycles navigation et rafraîchissement

- **GIVEN** une surface montée, démontée puis remontée plusieurs fois
- **WHEN** une navigation simulée et un rafraîchissement simulé sont répétés
- **THEN** aucun descendant n'a deux propriétaires DOM
- **AND** aucun listener actif n'est dupliqué
- **AND** chaque conteneur actif possède au plus un propriétaire
- **AND** le nombre de conteneurs React actifs ne dépasse jamais deux

#### Scenario: Deux conteneurs autorisés coexistent

- **GIVEN** une racine de coque dans l'hôte d'en-tête et une racine de détail
  dans le conteneur de contenu
- **WHEN** les deux surfaces sont actives
- **THEN** chaque conteneur possède exactement un propriétaire
- **AND** aucune racine ne réécrit le conteneur de l'autre
- **AND** le vanilla ne peut écrire ni dans l'un ni dans l'autre tant qu'ils
  sont actifs

## ADDED Requirements

### Requirement: Invalidation indépendante de la coque et du détail

La coque et le détail React SHALL pouvoir être invalidés séparément. Une
invalidation de la coque MUST NOT démonter ni réinitialiser la surface du
détail ; une invalidation du détail MUST NOT démonter ni réinitialiser la coque.
Aux frontières de route, d'identité ou d'état bloquant, chaque ancienne surface
concernée SHALL être libérée avant que le vanilla ne réécrive son conteneur.

#### Scenario: Shell unmount leaves the detail untouched

- **GIVEN** la coque et le détail React actifs dans deux conteneurs distincts
- **WHEN** la coque est invalidée pour un changement de route ou d'identité
- **THEN** seule la coque est démontée ou remplacée
- **AND** la racine du détail, son adaptateur et ses listeners restent uniques
- **AND** aucun contenu du détail n'est réécrit par la transition de la coque

#### Scenario: Detail unmount leaves the shell usable

- **GIVEN** la coque et le détail React actifs
- **WHEN** la route quitte le détail pour Overview ou une page de paramètres
- **THEN** seule la racine du détail est libérée avant le rendu vanilla
- **AND** la coque reste montée ou est remplacée selon sa propre frontière
- **AND** aucun contrôle du détail ne reste visible

#### Scenario: Identity and blocking boundaries release before vanilla

- **GIVEN** la coque et la surface détail sont actives pour une identité
  autorisée
- **WHEN** l'identité ou l'espace autorisé change, devient non vérifié ou
  qu'une lecture bloquante survient
- **THEN** les surfaces concernées sont invalidées avant toute réécriture
  vanilla de leurs conteneurs
- **AND** aucun contenu métier de l'ancien contexte n'est affiché ou copié
- **AND** aucune requête Cloud ou écriture IndexedDB supplémentaire n'est
  déclenchée par la transition de présentation

#### Scenario: Repeated mixed cycles do not accumulate owners

- **GIVEN** des cycles simulés de navigation, de rafraîchissement et de
  changement d'identité avec coque et détail montés ou non
- **WHEN** les cycles sont répétés
- **THEN** le nombre de racines actives reste borné à deux conteneurs
- **AND** chaque conteneur actif garde un propriétaire et un abonnement uniques
- **AND** aucun listener de l'ancienne surface ne reste actif
