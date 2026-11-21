# ASF-STITCH-001: Installer les Agent Skills Google Stitch

- **Type :** factory / documentation
- **Statut :** livré dans cette PR
- **Risque :** faible
- **Périmètre :** intégrer les skills de conception et de développement Stitch au dépôt pour découverte locale par les agents de coding.

## Résultat attendu

- Les 16 skills publiés par Google sont présents sous `.agents/skills/`, avec leurs ressources, exemples et scripts associés.
- La provenance est traçable à une révision précise de [google-labs-code/stitch-skills](https://github.com/google-labs-code/stitch-skills).
- Les noms de frontmatter respectent la convention Agent Skills locale et correspondent aux répertoires.
- Les prérequis Stitch MCP et la procédure de mise à jour sont documentés.
- Aucune configuration de secret ou aucun identifiant Stitch n'est ajouté au dépôt.

## Vérifications

- Comparer le nombre de répertoires `SKILL.md` au dépôt source épinglé.
- Vérifier que les noms de skills sont en kebab-case et concordent avec les noms de répertoires.
- Vérifier que les chemins relatifs des ressources et scripts référencés existent.
- Exécuter `npm run check` et contrôler la CI indépendante sur le SHA de la PR.

## Limites

L'ajout des fichiers ne configure pas le serveur Stitch MCP, les identifiants, ni les outils d'exécution nécessaires. Ces éléments restent à configurer dans l'environnement de l'agent selon la documentation officielle Stitch.

## Post-sync review

Confirmer les contrôles CI de la PR, la fusion autorisée, puis CI et Pages sur `main`. Pages ne publie pas le contenu des skills.
