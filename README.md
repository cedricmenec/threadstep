# ThreadStep

**Un espace de travail léger, local-first et directement dans le navigateur pour suivre la prochaine action concrète de chacun de vos sujets en parallèle.**

[![Accéder à l'application](https://img.shields.io/badge/Application_en_ligne-GitHub_Pages-2563eb?style=for-the-badge)](https://cedricmenec.github.io/threadstep/)
[![Guide utilisateur](https://img.shields.io/badge/Guide-Utilisation-0f766e?style=for-the-badge)](docs/product/guide-utilisation.md)
[![Documentation développeur](https://img.shields.io/badge/Docs-D%C3%A9veloppeur-475569?style=for-the-badge)](docs/product/developer-guide.md)

---

## Pourquoi ThreadStep ?

Les gestionnaires de tâches classiques imposent souvent trop de friction (dates d'échéance, statuts complexes, comptes obligatoires), tandis qu'une simple liste Markdown oblige à tout réorganiser à la main.

**ThreadStep** va à l'essentiel : vous ouvrez la page sur ordinateur ou téléphone, et vous voyez immédiatement **quoi reprendre ensuite** sur chaque sujet actif — sans compte requis par défaut et sans backend propriétaire.

## Fonctionnalités clés

- **Sujets et actions priorisées** — Organisez vos projets en parallèle avec trois niveaux de priorité : **Urgent**, **Normal** et **Plus tard**.
- **Sous-tâches claires et repliables** — Découpez une action sur un niveau de sous-tâches avec repli/dépli (« Voir N sous-tâches » / « Masquer les sous-tâches »).
- **Réordonnancement fluide** — Réorganisez actions principales et sous-tâches (au sein d'un même parent et d'une même priorité) au glisser-déposer ou au clavier.
- **Reprise rapide et sécurité d'édition** — Suivi de reprise (« Garder le fil »), notes détaillées, filtre des étapes terminées et suppression annulable pendant 10 secondes.
- **Local-first par défaut** — Vos données restent sur votre appareil dans **IndexedDB**, accessibles hors ligne et sans création de compte.
- **Synchronisation Dexie Cloud facultative** — Activation volontaire (opt-in) avec authentification email OTP native, espaces de travail isolés et diagnostic dédié.
- **Sauvegardes portables** — Export JSON vérifié (`threadstep.indexeddb-backup`), import/fusion non destructif avec prévisualisation et restauration protégée.

---

## Utiliser ThreadStep

### 1. Ouvrir l'application

Rendez-vous directement sur **[cedricmenec.github.io/threadstep](https://cedricmenec.github.io/threadstep/)** depuis votre navigateur (ordinateur ou mobile). Aucun compte n'est nécessaire pour démarrer en mode local autonome.

### 2. Prise en main en 4 étapes

1. **Créez un sujet / projet** depuis la vue d'ensemble **Mes projets** (`#/`).
2. **Ouvrez le détail du projet** (`#/sujet/<id>`) pour ajouter vos actions et choisir leur priorité (**Urgent**, **Normal**, **Plus tard**).
3. **Structurez et ajustez** via le menu `⋮` d'une action : ajouter une sous-tâche, modifier le titre ou la note, activer le suivi de reprise ou déplacer l'élément au clavier.
4. **Naviguez depuis le bouton « Menu »** entre les quatre espaces de l'application :
   - **Mes projets** (`#/`) — Vue d'ensemble de vos sujets actifs.
   - **Paramètres** (`#/parametres`) — Point d'entrée des réglages.
   - **Imports / Exports** (`#/parametres/donnees`) — Sauvegarde, import/fusion et restauration.
   - **Synchronisation Dexie Cloud** (`#/parametres/synchronisation`) — Configuration Cloud opt-in, connexion OTP, espaces de travail et diagnostic en lecture seule.

Pour le détail complet des gestes, raccourcis clavier et comportements, consultez le [guide d'utilisation complet](docs/product/guide-utilisation.md) et la [checklist de recette](docs/product/acceptance-checklist.md).

---

## Stockage, sauvegarde et synchronisation

ThreadStep enregistre les données métier dans **IndexedDB** directement dans votre navigateur :

| Mode | Stockage local | Réplication distante | Compte requis |
| --- | --- | --- | --- |
| **Local autonome** *(par défaut)* | Base IndexedDB `threadstep-local` | Aucune | Non |
| **Dexie Cloud** *(facultatif)* | Cache IndexedDB dédié par espace (`threadstep-ws-…`) | Oui, après configuration HTTPS, connexion OTP et consentement explicite | Oui (email OTP) |

> [!NOTE]
> Les anciennes clés `localStorage` V1 éventuellement encore présentes sur votre navigateur ne sont plus le stockage métier courant. Les anciens fichiers d'export `version: 1` sont explicitement refusés à l'import sans écriture.

### Sauvegarder, importer ou restaurer

Dans **Menu → Imports / Exports** (`#/parametres/donnees`) :

- **Exporter** génère un fichier JSON portable au format `threadstep.indexeddb-backup` (données métier uniquement, sans secret, OTP ni réglage Cloud).
- **Importer et fusionner** ajoute les éléments d'une sauvegarde de façon additive après prévisualisation et confirmation.
- **Restaurer** remplace l'état courant après téléchargement préalable d'une sauvegarde et confirmation renforcée (`RESTAURER`).

> [!IMPORTANT]
> Conservez toujours vos sauvegardes **en dehors des données du navigateur**. Si le stockage apparaît bloqué, vide ou illisible, suivez d'abord le diagnostic dans **Menu → Synchronisation Dexie Cloud** et **ne purgez jamais** les données en supposant que le Cloud est vide.

Guides détaillés :
- [Importer, exporter et restaurer : procédures et format JSON](docs/product/guide-import-export.md)
- [Comprendre la persistance et la synchronisation](docs/product/guide-persistance-et-synchronisation.md)

---

## Développement local

### Prérequis

- **Node.js** — version indiquée dans `.nvmrc` (voir aussi `engines.node` dans `package.json`).
- **npm** — installation reproductible via `npm ci`.

### Lancer et vérifier le projet

```sh
# 1. Installer les dépendances verrouillées
npm ci

# 2. Lancer le serveur de développement Vite (servi sous /threadstep/)
npm run dev

# 3. Exécuter la suite complète de vérifications (tests, backlog, syntaxe)
npm run check
```

### Commandes principales

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Démarre le serveur de développement Vite sous `/threadstep/` |
| `npm run build` | Construit l'artefact statique de production dans `dist/` |
| `npm run preview` | Prévisualise le build `dist/` localement sous `/threadstep/` |
| `npm test` | Exécute les tests automatisés (`node --test tests/*.test.mjs`) |
| `npm run check` | Exécute les tests, `backlog:check` et la vérification syntaxique des modules |
| `npm run verify:build` | Compare deux builds et contrôle reproductibilité, chemins et CSP |
| `npm run verify:servers` | Vérifie les serveurs `dev` et `preview` sous `/threadstep/` |
| `npm run backlog:index` | Régénère `backlog/index.json` après modification d'une fiche de tâche |

### Structure du dépôt

```text
threadstep/
├── site/         # Source de l'application web (HTML, CSS, JS/JSX, Dexie bundlé localement)
├── tests/        # Suite de tests Node et jsdom
├── docs/         # Documentation produit, architecture, sécurité et factory (ASF)
├── backlog/      # Tâches produit versionnées en Markdown et index généré
├── openspec/     # Spécifications canoniques OpenSpec et archives de changements
├── scripts/      # Scripts produit et outillage ASF
└── tools/        # Scripts de build vendor et de vérification du build Vite
```

L'application est publiée en tant que site statique sur **GitHub Pages** à partir de l'artefact Vite `dist/` (construit depuis `site/`), sans CDN tiers ni backend produit, avec une CSP stricte limitant `connect-src` aux hôtes Dexie Cloud.

---

## Autonomous Software Factory (ASF) & Contribution

Ce dépôt sert également de produit pilote pour une **Autonomous Software Factory (ASF)** réutilisable, pilotée par spécifications versionnées (OpenSpec), backlog Markdown, tests automatisés et workflows GitHub Actions sous contrôle strict.

- **Règles de contribution :** travailler sur une branche dédiée (jamais directement sur `main`), ne jamais committer de secrets ou clés API, et exécuter `npm run check` avant toute proposition.
- **Sessions agents / ChatGPT :** lire d'abord [`AGENTS.md`](AGENTS.md) (carte d'entrée) ou [`ChatGPT.md`](ChatGPT.md) (navigation et permissions), ainsi que [`agents-asf.md`](agents-asf.md) pour tout travail lié à l'ASF.

### Carte documentaire

| Domaine | Documents de référence |
| --- | --- |
| **Produit & usage** | [Vision produit](docs/product/vision.md) · [Guide utilisateur](docs/product/guide-utilisation.md) · [Import / Export](docs/product/guide-import-export.md) · [Persistance & Sync](docs/product/guide-persistance-et-synchronisation.md) · [Recette](docs/product/acceptance-checklist.md) |
| **Technique & sécurité** | [Guide développeur](docs/product/developer-guide.md) · [Règles de sécurité et confidentialité](docs/security/README.md) · [Spécifications OpenSpec](openspec/specs/) |
| **Backlog** | [Backlog produit](backlog/README.md) · [Tâches](backlog/tasks/) |
| **Software Factory (ASF)** | [Documentation ASF](docs/factory/README.md) · [État courant](docs/factory/current-state.md) · [Guide développeur ASF](docs/factory/developer-guide.md) · [Mode opératoire OpenSpec](docs/factory/openspec-manual-pilot.md) · [Reprise et tests de panne](docs/factory/validation-and-recovery.md) · [Clôture V2 (16/10/2026)](docs/factory/closeout-2026-10-16.md) · [Évolution vers 10–15 tâches](docs/factory/scale-to-ten.md) |
