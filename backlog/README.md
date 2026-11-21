# Backlog ThreadStep

Les fiches actives sont dans [`tasks/`](tasks/) et projetées par
[`index.json`](index.json). Les fiches fermées sont dans [`archive/`](archive/)
et résumées dans [`archive-index.json`](archive-index.json). Ces deux index sont
générés depuis les fichiers Markdown : ne pas les modifier à la main.

## Fiches actives

| ID | Sujet | Statut |
| --- | --- | --- |
| [TS-069](tasks/TS-069.md) | Mise en valeur du formulaire d’édition d’une tâche | `ready` |
| [TS-070](tasks/TS-070.md) | Filtre compact des projets dans Overview | `ready` |

## Fiches archivées

Les 64 fiches présentes de TS-001 à TS-068 ont été fermées à la demande du
propriétaire. TS-053 à TS-056 n'existent pas. Elles portent `status: done` et
`closure: administrative` ; cela clôt leur suivi dans le backlog sans attester
la livraison de leur périmètre. `delivery: null` signifie qu'aucune preuve de
livraison n'est enregistrée. Les critères et cases d'acceptation d'origine sont
conservés dans chaque fiche.

TS-068 a également une PR d'implémentation séparée (#231) ; l'archivage
administratif du brief ne remplace pas la vérification de cette PR.

## Vérifier ou régénérer les index

```sh
npm run backlog:check
npm run backlog:index
```

Les règles de statut, d'archivage et de preuve sont décrites dans le
[contrat de tâche](../docs/factory/backlog-v2-task-contract.md) et la
[spécification Backlog V2](../docs/factory/specs/backlog-v2.md).
