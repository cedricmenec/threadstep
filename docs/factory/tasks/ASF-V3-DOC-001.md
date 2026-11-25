# ASF-V3-DOC-001 | Référentiel exhaustif des workflows ASF

Status: proposed
Type: factory
Automation: manual
Priority: high
Dependencies: none
Phase: ASF V3 / documentation transverse
Created: 2026-10-16

## Problème et valeur

Les informations sur le manuel, OpenSpec, l'orchestrateur de backlog, l'Agent ASF, CI et Pages sont dispersées entre guides et YAML. Un lecteur doit pouvoir comprendre dès le premier passage **pourquoi** un workflow et chacune de ses étapes existent, ce qu'ils font concrètement et comment leurs contrôles échouent.

## Programme documentaire global, indépendant des modifications de code

- Une carte d'orientation fonctionnelle pour les six workflows GitHub Actions actifs.
- Pour chaque workflow : déclenchement, acteurs et permissions, paramètres, jobs et steps **dans l'ordre réel**, entrées/sorties, scripts/actions exécutés, effets, coûts, échecs, récupérations et pertinence fonctionnelle.
- Un diagramme de séquence pour les parcours manuels, OpenSpec, la vague et l'exécuteur ASF ; distinction entre PR créée, CI réussie, fusion et livraison.
- Une matrice d'interactions entre workflows et entre GitHub App, OpenRouter, branches, manifeste, journal et source de vérité.
- Un modèle de fiche de step stable avec les sections et contrôles de maintenance ; tracer des liens exacts vers YAML/scripts/tests.
- Une vérification de dérive documentaire à concevoir ultérieurement (au minimum revue manuelle YAML vs fichiers de documentation ; validation automatique en PR distincte après spécification).

## Périmètre de cette première PR documentaire

- [x] Inventaire exhaustif des **six** fichiers workflows actuellement actifs, avec entrée, jobs et usage.
- [x] Contrat commun de documentation fonctionnelle et technique à granularité workflow, job et step.
- [x] Premier pilote détaillé : chaque job et chaque step de l'exécuteur `agent-asf.yml` de V2, en distinguant historique et comportement actuel.
- [x] Références vers les docs et scripts existants ; signalement explicite des cinq guides de steps restant à rédiger.
- [x] Documentation dans la même PR que cette fiche, sans toucher aux fichiers d'exécution.

## Lots documentaires suivants

L'objectif de documentation exhaustive n'est **pas** atteint par cette première PR. Prévoir ensuite des PR indépendantes (noms à déterminer) pour `agent.yml`, `agent-openspec.yml`, `backlog-orchestrator.yml`, `ci.yml`, `pages.yml` puis les diagrammes, la matrice d'interactions et le contrôle de dérive. Éviter de déclarer un guide « complet » s'il n'est pas vérifié step par step contre son YAML.

## Hors périmètre

Aucune modification de workflows, scripts, CI, permissions, secrets, règles de fusion ou budgets. Pas de run OpenRouter. Documentation **as-is** V1/V2 et non présentation de la V3 proposée comme déployée.

## Vérification / revue

Relire le YAML sur le SHA exact et comparer l'inventaire de ses steps au pilote, y compris les `if`, permissions et actions GitHub. Exécuter `npm run check` lorsque l'environnement s'y prête, puis vérifier la CI indépendante `check` après ouverture de la PR. Aucun de ces résultats n'est attesté dans la présente fiche.

Fusion uniquement après autorisation explicite, CI requise et revue humaine. Les descriptions de secrets doivent se limiter aux **noms** de variables autorisées, jamais à leurs valeurs.
