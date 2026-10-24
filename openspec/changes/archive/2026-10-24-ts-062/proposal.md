# Proposal

## Why

Les 32 références mobiles M01 à M32 et les quatre écrans desktop conservés dans
Stitch ont été générés mais jamais validés fonctionnellement. Le risque est
qu'un futur lot, notamment TS-063, traite une proposition visuelle comme une
règle métier approuvée et altère les gestes, les calculs, la navigation ou les
protections de données de ThreadStep. Il manque un catalogue versionné qui
distingue ce qui est conservé, à corriger, à décider ou à rejeter.

## What Changes

- Créer une synthèse versionnée sous `docs/product/` qui inventorie M01 à M32
  et exactement quatre références desktop, avec identifiant, fonction ou état
  observé, statut de revue contrôlé et lien Stitch identifiable.
- Établir la hiérarchie des sources : spécifications canoniques, code livré et
  contrats de sécurité priment toujours sur les maquettes. Une maquette ne peut
  ni créer ni modifier une règle métier.
- Ajouter une matrice traçable `conserver / corriger dans Stitch / décision
  produit distincte / rejeter`, avec origine, différence observable, catégorie
  style/structure/interaction/nouvelle fonctionnalité, risque, propriétaire de
  décision (utilisateur) et liens.
- Relier chaque écart fonctionnel à une règle existante ou à une décision
  explicite, en couvrant notamment l'espace actif, les quatre destinations,
  l'aperçu de cinq tâches parentes, les compteurs et suggestions déterministes,
  la hiérarchie à un niveau, les priorités des sous-tâches, les notes en texte
  brut, la reprise, l'Undo, le consentement, l'authentification, la
  synchronisation et la restauration.
- Repérer séparément les idées non autorisées par le contrat actuel :
  recherche, archives, partage, Markdown, raccourcis et statistiques.
- Consigner les variantes 320, 390, 430 et 768 px, les composants réutilisables
  et les points de contraste, cible tactile, focus et texte à vérifier. M32
  reste une proposition de composants, jamais une certification d'accessibilité.
- Identifier soit un sous-ensemble validé pour le header, le menu et les quatre
  destinations de TS-063, soit les points bloquants et la décision attendue.
  Le prérequis TS-063 reste fermé jusqu'à validation humaine explicite.
- Consigner les références non examinées ou rejetées et ne jamais assimiler une
  génération Stitch, un lien ou une CI verte à une revue humaine ou à un essai
  sur appareil réel.
- Ne modifier aucune maquette signée-off, aucun code produit, test, donnée,
  configuration Cloud, workflow, backlog ni secret. Aucune correction dans
  Stitch n'est appliquée par défaut ; elle peut seulement être proposée si son
  périmètre et l'accès sont validés.

## Capabilities

### New Capabilities

- `design-reference-catalog` : gouvernance documentaire durable des références
  visuelles externes, avec inventaire exhaustif, statuts de revue, traçabilité
  vers les règles produit, classification des écarts, observations responsive
  et accessibilité, registre des idées non autorisées et porte de validation
  vers TS-063.

### Modified Capabilities

- Aucune : la présente tâche ne change aucun comportement applicatif, aucune
  route, aucun stockage, aucune synchronisation, aucun consentement ni aucun
  format de données. Seuls la documentation produit et les artefacts OpenSpec
  du changement évoluent.

## Impact

- Nouveau document versionné `docs/product/stitch-reference-catalog.md`, avec
  le catalogue, la matrice,
  les observations responsive/accessibilité, le registre des idées non
  autorisées, le bilan de validation humaine et la porte TS-063.
- Artefacts OpenSpec de `ts-062` uniquement.
- Aucun changement sous `site/`, `tests/`, `scripts/`, `.github/`, `backlog/`,
  `openspec/specs/` existant, `AGENTS.md`, `opencode.json` ni configuration
  Cloud. Aucun fichier de secret ni donnée personnelle.
- `npm run check` et `openspec validate ts-062 --strict --no-interactive`
  doivent passer. Les vérifications de complétude du catalogue sont exécutées
  par des assertions Node déterministes pendant `apply` ; aucun test permanent
  n'est ajouté, afin de respecter la contrainte « aucune modification de code ».

## Non-goals

- Implémentation React ou CSS, migration d'Overview, des tâches, des éditeurs,
  des paramètres ou de la navigation, adoption de Tailwind ou d'un design
  system.
- Développement d'une fonctionnalité suggérée par Stitch, nouvelle route,
  recherche, archive, partage, Markdown, raccourci ou statistique.
- Réécriture du moteur Dexie, modification des comptes, sauvegardes ou données
  Cloud réelles.
- Génération, correction ou signature de maquettes Stitch dans ce changement,
  ainsi que tout appel externe payant.
- Remplacer la validation du propriétaire par une décision de l'agent.

## Uncertainties and decisions to confirm

- **Accès Stitch non garanti sur le runner.** Le dépôt ne fournit ni session
  autorisée ni liens profonds par écran. L'inventaire doit donc rester honnête :
  chaque référence non inspectable est marquée `NOT_REVIEWED`, avec le lien du
  projet Stitch et son identifiant, et aucune validation intégrale n'est
  revendiquée. Aucun nom d'écran, état ou parcours ne doit être inventé.
- **Identifiants desktop inconnus.** La tâche mentionne quatre écrans desktop
  sans identifiants. Le catalogue peut utiliser des identifiants locaux
  `DESKTOP-1` à `DESKTOP-4`, explicitement déclarés comme convention de
  catalogue et non comme identifiants officiels Stitch.
- **Aucune validation humaine pendant `apply`.** Le sous-ensemble de navigation
  pour TS-063 ne peut être déclaré validé que par une décision propriétaire
  consignée. À défaut, le catalogue liste les candidats et les points bloquants,
  et laisse la porte TS-063 fermée.
- **Aucun test documentaire permanent.** Pour respecter « aucune modification
  de code, de données, de configuration Cloud ou de workflow », les contrôles
  de complétude et de cohérence sont des assertions exécutées pendant `apply`,
  pas un nouveau fichier sous `tests/`. Si le propriétaire souhaite un test
  permanent, cette décision relève d'une tâche distincte.
- **Décisions produit inconnues.** Les désaccords réels sur les suggestions,
  priorités, textes Cloud, sous-tâches ou commandes hors périmètre restent des
  `PRODUCT_DECISION_REQUIRED` ; ils ne sont ni tranchés ni transformés en
  exigences par cette proposition.
