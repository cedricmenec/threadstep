# Backlog ThreadStep

Les fiches actives sont dans [`tasks/`](tasks/) et projetées par
[`index.json`](index.json). Les fiches fermées sont dans [`archive/`](archive/)
et résumées dans [`archive-index.json`](archive-index.json). Ces deux index sont
générés depuis les fichiers Markdown : ne pas les modifier à la main.

## Fiches actives

Aucune. `index.json` est vide.

## Fiches archivées

Les 64 fiches présentes de TS-001 à TS-068 ont été fermées à la demande du
propriétaire. TS-053 à TS-056 n'existent pas. Elles portent `status: done` et
`closure: administrative`, avec `delivery: null` : cela clôt leur suivi sans
attester la livraison de leur périmètre. Les critères d'origine restent
inchangés.

TS-069 et TS-070 sont livrées par les PR [#228](https://github.com/cedricmenec/threadstep/pull/228)
et [#230](https://github.com/cedricmenec/threadstep/pull/230). Leurs SHA et
preuves CI/Pages vérifiées figurent dans `archive-index.json`. La recette visuelle
sur appareils réels n'est pas attestée par ces contrôles automatisés.

TS-068 a été livrée par la PR [#231](https://github.com/cedricmenec/threadstep/pull/231).

## Vérifier ou régénérer les index

```sh
npm run backlog:check
npm run backlog:index
```

Les règles de statut, d'archivage et de preuve sont décrites dans le
[contrat de tâche](../docs/factory/backlog-v2-task-contract.md) et la
[spécification Backlog V2](../docs/factory/specs/backlog-v2.md).
