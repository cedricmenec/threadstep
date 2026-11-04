# ThreadStep

**Mise à jour : 16 octobre 2026.** ThreadStep comprend maintenant le
repli « Voir N sous-tâches » / « Masquer les sous-tâches » (TS-012/13)
et le réordonnancement des sous-tâches par parent/priorité (TS-014).
Le [guide utilisateur](docs/product/guide-utilisation.md) et la
[recette](docs/product/acceptance-checklist.md) couvrent ces fonctions.
La [factory ASF V2](docs/factory/README.md) est **clôturée pour son périmètre 1–2 tâches**
([rapport vérifié](docs/factory/closeout-2026-10-16.md)) ; [guide développeur ASF](docs/factory/developer-guide.md),
[reprise et tests de panne](docs/factory/validation-and-recovery.md)
et [évolution vers dix tâches](docs/factory/scale-to-ten.md).


A lightweight, browser-only workspace for tracking the next action across several parallel subjects.

Public demo: https://cedricmenec.github.io/threadstep/

This repository is the first experimental product for a reusable, GitHub Actions-based autonomous software factory. Development is driven by versioned specifications, a Markdown backlog, tests, and explicit agent triggers. Never commit API keys.

**Utiliser ThreadStep :** [guide en français](docs/product/guide-utilisation.md)
(sujets, priorités, actions et sous-tâches réordonnables, repli avec
compteur, suppression annulable pendant 10 secondes, sauvegarde/export).
Les fonctionnalités TS-012/013/014 sont livrées via les PR #55/#58/#59.

**Nouvelle conversation avec ChatGPT :** lire d'abord
[**ChatGPT.md**](ChatGPT.md), puis les sources de vérité qu'il indique.
Il sert de guide de navigation et de permissions, pas d'état daté.

**Software Factory :** [état courant](docs/factory/current-state.md) et
[mode opératoire OpenSpec](docs/factory/openspec-manual-pilot.md).

See `docs/` for the product and architecture and `backlog/` for tasks.

## Sauvegarde, import et stockage

Les données métier sont enregistrées dans **IndexedDB** dans le navigateur.
La synchronisation **Dexie Cloud** est facultative et dépend de l'espace actif.
Les anciennes clés localStorage V1 conservées ne sont plus le stockage métier
courant.

- [Importer, exporter et restaurer : procédures et format JSON](docs/product/guide-import-export.md).
- [Comprendre la persistance et la synchronisation](docs/product/guide-persistance-et-synchronisation.md).

Dans **Menu → Imports / Exports**, l'export produit un fichier
`threadstep.indexeddb-backup`. L'import fusionne après prévisualisation ;
la restauration peut remplacer les données et exige une sauvegarde préalable
et une confirmation renforcée. Les anciens fichiers `version: 1` sont refusés.

Conservez les sauvegardes hors des données du navigateur. Si le stockage est
bloqué ou illisible, suivez le diagnostic et ne purgez pas les données en
supposant que le Cloud est vide.
