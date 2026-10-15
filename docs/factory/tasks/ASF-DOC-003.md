# ASF-DOC-003 | Point d'entrée ChatGPT sans mémoire

Status: completed (documentary scope)
Date: 2026-10-15
Scope: documentation de démarrage de conversation, sans code ni workflows
Priority: normal
Execution: aucun run OpenRouter ou OpenSpec demandé

## Besoin

Permettre à un nouvel agent ChatGPT, sans mémoire de conversations
précédentes, de comprendre rapidement **comment retrouver la vérité
actuelle** du dépôt, comment traiter les besoins de ThreadStep et
comment piloter ou faire évoluer la Software Factory avec les bonnes
autorisations.

Le fichier d'accueil doit être nommé exactement **`ChatGPT.md`**
à la racine. Il ne doit pas devenir un nouveau miroir de
`current-state.md` ni des paramètres de GitHub Actions.

## Livrables et critères réalisés

- [x] Créer `ChatGPT.md` au niveau racine du dépôt.
- [x] Rendre explicite la différence entre **l'application pilote**
  ThreadStep et la **factory générique** à réutiliser pour d'autres
  applications.
- [x] Indiquer les sources de vérité et l'ordre de lecture :
  `AGENTS.md`, état courant, documentation factory, backlog,
  contrat produit, specs OpenSpec, workflows et code/test.
- [x] Décrire la création de tâches `TS-NNN` sans présumer du
  prochain numéro, la PR documentaire, la CI et la livraison.
- [x] Distinguer la mise en œuvre d'une tâche, une évolution de la
  factory et une réconciliation documentaire.
- [x] Orienter vers les deux workflows agents, la CI et Pages,
  sans recopier leurs choix de modèles et valeurs par défaut.
- [x] Énoncer le contrôle des permissions et des autorisations,
  les dangers du coût OpenRouter, les règles d'auto-merge,
  le passage obligatoire par la PR/CI et la reprise des incidents.
- [x] Prévoir le cas d'une nouvelle conversation **sans outil
  GitHub capable de lancer workflow_dispatch** : ne jamais feindre
  d'avoir lancé une exécution.
- [x] Ajouter des liens d'entrée depuis le README racine et celui
  de la factory, pour rendre le document découvrable.
- [x] Préserver les informations volatiles dans les documents
  maintenus en continu et les API GitHub vérifiées en direct.

## Revue externe après publication

Vérifier les chemins/liens, le diff documentaire, la CI sur le
dernier SHA de PR, l'autorisation explicite de fusion, puis
la CI de main et Pages. Les références de runs appartiennent
à la description de la PR et à la réponse finale plutôt qu'à
ce guide intemporel.

## Hors périmètre

Changer `AGENTS.md`, configurer GitHub, modifier workflows, scripts,
code produit, secrets, modèles ou politique de fusion. Aucun
nouveau déclenchement payé pour tester le document.

## Preuve de référence avant édition

Le 15 octobre 2026 : `main` =
`8f819efa9686d2e8b5adb7a82cf1609c55d948e4` ;
CI et Pages correspondants réussis. Cette preuve est
**historique** et ne doit pas être reproduite dans
`ChatGPT.md`, qui renvoie à l'état GitHub au moment d'agir.
