# ThreadStep

A lightweight, browser-only workspace for tracking the next action across several parallel subjects.

Public demo: https://cedricmenec.github.io/threadstep/

This repository is the first experimental product for a reusable, GitHub Actions-based autonomous software factory. Development is driven by versioned specifications, a Markdown backlog, tests, and explicit agent triggers. Never commit API keys.

**Utiliser ThreadStep :** [guide en français](docs/product/guide-utilisation.md)
(sujets, priorités, glisser-déposer au sein d'une priorité,
suppression avec « Annuler » pendant 10 secondes, sauvegarde/export).
Les fonctions TS-010 et TS-011 sont livrées depuis les PR #32 et #34.

**Nouvelle conversation avec ChatGPT :** lire d'abord
[**ChatGPT.md**](ChatGPT.md), puis les sources de vérité qu'il indique.
Il sert de guide de navigation et de permissions, pas d'état daté.

**Software Factory :** [état courant](docs/factory/current-state.md) et
[mode opératoire OpenSpec](docs/factory/openspec-manual-pilot.md).

See `docs/` for the product and architecture and `backlog/` for tasks.

## Dépannage du stockage local

ThreadStep conserve vos données uniquement dans le `localStorage` du navigateur (clé `threadstep.document.v1`). Aucune copie n'est envoyée sur un serveur.

- **Stockage bloqué** : en navigation privée ou si les cookies/site data sont refusés, l'enregistrement échoue (message « Stockage indisponible : exportez vos données. »). Autorisez le stockage pour ce site, ou continuez en exportant votre travail.
- **Données effacées** : vider le cache, les cookies ou les données de site, changer de navigateur/profil, ou désactiver la persistance supprime les données locales. Le message « Données locales illisibles » indique un contenu corrompu : réimportez un export JSON.
- **Reprise** : pour éviter toute perte, utilisez régulièrement le bouton d'export JSON et réimportez le fichier sur le même navigateur ou sur un autre appareil.
