# semantic-design-tokens Specification

## Purpose

Fournir un vocabulaire visuel sémantique, centralisé et versionné que les
surfaces React et vanilla peuvent partager, avec une parité graphique maîtrisée,
des objectifs d'accessibilité mesurables et un build statique sans ressource
distante.

## ADDED Requirements

### Requirement: Centralized semantic token catalogue

Le projet SHALL définir un catalogue unique de tokens sémantiques couvrant
couleur, typographie, espacement, rayons, focus, erreur, état désactivé et
responsive. Chaque token SHALL avoir un nom sémantique, une valeur documentée
et une source versionnée unique, afin que React et le rendu vanilla partagent
le même vocabulaire.

#### Scenario: Required token categories are present

- **WHEN** le catalogue de tokens est inspecté
- **THEN** il contient explicitement les catégories couleur, typographie,
  espacement, rayons, focus, erreur, état désactivé et responsive
- **AND** chaque catégorie documente ses tokens et leur usage

#### Scenario: Single token source

- **WHEN** une règle CSS ou un composant partagé référence une variable
  sémantique
- **THEN** cette variable est définie dans le fichier de tokens versionné
- **AND** aucune seconde définition contradictoire de la même variable n'est
  requise pour obtenir le rendu prévu

#### Scenario: Existing values are mapped

- **WHEN** les valeurs tokenisées sont comparées aux valeurs livrées avant le
  changement
- **THEN** les couleurs, tailles, espacements et rayons partagés conservent
  leurs valeurs existantes
- **AND** aucune nouvelle palette, police ou échelle typographique n'est
  introduite

### Requirement: Local delivery and no remote asset

Les tokens SHALL être importés par le CSS local et inclus dans le build Vite
sous `/threadstep/`. Le chargement MUST NOT exiger de police distante, de
bibliothèque d'icônes, de CDN ou de feuille CSS externe, et la CSP de production
MUST rester inchangée.

#### Scenario: Tokens are embedded in the build

- **WHEN** `npm run build` puis l'artefact CSS sont inspectés
- **THEN** les définitions des tokens partagés sont présentes dans l'artefact
- **AND** les chemins d'assets restent résolus sous `/threadstep/`

#### Scenario: No remote font, icon or stylesheet

- **WHEN** les sources CSS et l'artefact construit sont inspectés
- **THEN** aucune police, icône, feuille de style ou autre ressource distante
  n'est chargée à l'exécution
- **AND** aucune dépendance Tailwind ou bibliothèque d'icônes n'est ajoutée

#### Scenario: CSP and production paths remain unchanged

- **WHEN** le document construit et ses en-têtes sont inspectés
- **THEN** la CSP de production reste celle de `site/index.html`, avec
  `script-src 'self'` sans `unsafe-inline` ni `unsafe-eval`
- **AND** aucun chemin local absolu hors `/threadstep/` n'est introduit

### Requirement: Measured accessibility targets and declared exceptions

Les paires texte/fond utilisées par les primitives SHALL viser 4,5:1 et les
indicateurs de focus ou éléments non textuels 3:1 ; les cibles tactiles visées
SHALL être de 44 px lorsque le contexte l'exige. Les ratios SHALL être mesurés
et les exceptions préexistantes documentées sans être présentées comme
conformes.

#### Scenario: Token contrast is measured deterministically

- **WHEN** l'audit de contraste des tokens s'exécute
- **THEN** il calcule et consigne le ratio de chaque paire texte/fond et
  focus/fond documentée
- **AND** il indique les valeurs inférieures aux cibles avec leur usage exact

#### Scenario: A new exception cannot stay silent

- **WHEN** une nouvelle paire de tokens utilisée par une primitive est sous la
  cible applicable
- **THEN** elle figure dans le registre d'exceptions avec son ratio mesuré et
  sa justification
- **AND** il n'est pas affirmé que la cible est atteinte

#### Scenario: Focus and disabled states are perceivable

- **WHEN** une primitive reçoit le focus clavier ou passe à l'état désactivé
- **THEN** le style de focus visible provient d'un token dédié
- **AND** l'état désactivé reste distinguable autrement que par la seule
  couleur, notamment par `disabled` et son opacité

#### Scenario: Touch target objective is traceable

- **WHEN** une primitive interactive est rendue dans un contexte de commande
  tactile
- **THEN** le token de cible de 44 px est utilisé ou une exception documentée
  explique l'écart
- **AND** l'existence du token ne vaut pas preuve de mesure sur un appareil réel

### Requirement: Responsive stability of tokenized surfaces

Les surfaces tokenisées SHALL rester utilisables sans débordement horizontal
aux largeurs 320, 390, 430, 768 et 1280 px. Les règles partagées MUST autoriser
le retour à la ligne, borner les largeurs à la zone disponible et documenter
les points de rupture, sans imposer une nouvelle disposition.

#### Scenario: Representative widths do not overflow

- **WHEN** une surface utilisant les primitives est affichée à 320, 390, 430,
  768 et 1280 px
- **THEN** aucun débordement horizontal n'est introduit par les primitives
- **AND** les libellés longs, notes et commandes restent lisibles

#### Scenario: Long text wraps within its container

- **WHEN** un titre, un libellé de commande ou une note dépasse la largeur
  disponible
- **THEN** le texte revient à la ligne dans la zone autorisée
- **AND** aucune largeur fixe supérieure à la largeur mobile n'est imposée

#### Scenario: Structural checks and real viewports stay distinct

- **WHEN** les garde-fous structurels déterministes réussissent
- **THEN** ils prouvent les règles de largeur, de retour à la ligne et de
  média query versionnées
- **AND** ils ne sont pas présentés comme une mesure de débordement sur un
  navigateur ou un appareil réel

### Requirement: Progressive adoption without forced React

Les tokens SHALL être consommables par le CSS vanilla sans monter React. Ce
changement MUST NOT créer de préférence persistée, de route, de clé de stockage,
de migration ou d'activation React sur Overview ou les pages de paramètres.

#### Scenario: React and vanilla share tokens

- **GIVEN** une règle CSS vanilla existante et une primitive React
- **WHEN** elles utilisent le même token sémantique
- **THEN** elles obtiennent la même valeur de couleur, d'espacement ou de rayon
- **AND** aucune migration de la route vanilla n'est nécessaire

#### Scenario: No persisted design preference

- **WHEN** le document, `localStorage`, IndexedDB, l'export et les routes sont
  inspectés après le changement
- **THEN** aucune préférence de thème, token ou composant n'a été persistée
- **AND** aucune nouvelle clé de stockage, route ou migration n'existe

#### Scenario: Rollback leaves data untouched

- **WHEN** les tokens et les primitives sont retirés ou laissés inutilisés
- **THEN** le rendu vanilla reste la référence
- **AND** aucune donnée, identité, sauvegarde, configuration Cloud ou
  préférence utilisateur n'est modifiée
