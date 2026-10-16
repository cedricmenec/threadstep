# ChatGPT.md — Démarrer une nouvelle session sur ce dépôt

> **Instruction d'accueil pour un agent ChatGPT sans mémoire du projet.**
> Lire ce document avant d'agir, puis consulter les sources de vérité
> ci-dessous. **Ce fichier est une carte et une méthode, pas un état
> figé.** Ne pas recopier ici les valeurs de formulaire, modèles, numéros
> de PR, derniers tests ou statuts de tâches : ils changent.

## 1. Identifier le projet et les règles

- Dépôt pilote : [`cedricmenec/threadstep`](https://github.com/cedricmenec/threadstep).
  **ThreadStep** est une application Web statique, locale au navigateur.
  L'**Autonomous Software Factory (ASF)** est la méthode et
  l'infrastructure de développement pilotées par GitHub Actions,
  OpenCode, OpenRouter et, pour les changements fonctionnels, OpenSpec.
  La factory est destinée à être **réutilisable avec d'autres produits** :
  ne pas généraliser les règles métiers de ThreadStep à la factory.
- **Lire impérativement [`AGENTS.md`](AGENTS.md) avant tout changement.**
  C'est le contrat du dépôt : sécurité, protection des fichiers, tests,
  consignes des agents et protocole de préparation des tâches.
  En cas de divergence, vérifier le code et le workflow en vigueur ;
  ne pas inventer une permission à partir de ce document.
- La demande de l'utilisateur détermine le **périmètre autorisé**.
  Préparer une tâche n'autorise **ni l'exécution payante d'un modèle, ni
  sa fusion automatique, ni une modification des secrets**.
  Obtenir une autorisation explicite pour chaque action sensible.
  Une permission donnée dans une ancienne conversation n'est pas
  une autorisation perpétuelle.
- Ne jamais insérer de secrets, de données personnelles ou de clés
  OpenRouter dans les sources, les PR, les logs ou la réponse.

## 2. Lire les sources de vérité dans cet ordre

| Pourquoi | Source à consulter |
| --- | --- |
| Règles applicables aux agents et aux changements | [`AGENTS.md`](AGENTS.md) |
| Statut **vérifié** de la factory, preuves et limites | [`docs/factory/current-state.md`](docs/factory/current-state.md) |
| Carte de la factory et documentation de référence | [`docs/factory/README.md`](docs/factory/README.md) |
| Développer et maintenir la factory ASF V2 | [`docs/factory/developer-guide.md`](docs/factory/developer-guide.md), [`docs/factory/validation-and-recovery.md`](docs/factory/validation-and-recovery.md) |
| Orchestration owner-only 1..2 tâches ; envisager 1..10 | [`docs/factory/backlog-orchestrator-manual.md`](docs/factory/backlog-orchestrator-manual.md), [`docs/factory/scale-to-ten.md`](docs/factory/scale-to-ten.md) |
| Guide développeur et recette ThreadStep | [`docs/product/developer-guide.md`](docs/product/developer-guide.md), [`docs/product/acceptance-checklist.md`](docs/product/acceptance-checklist.md) |
| Exécution OpenSpec et commande de lancement | [`docs/factory/openspec-manual-pilot.md`](docs/factory/openspec-manual-pilot.md) |
| Procédure GitHub, permissions, CI et fusion | [`docs/factory/github-autonomy-and-security.md`](docs/factory/github-autonomy-and-security.md) |
| Méthode, architecture, décisions et suite | [`docs/factory/operating-methodology.md`](docs/factory/operating-methodology.md), [`technical-architecture.md`](docs/factory/technical-architecture.md), [`decisions.md`](docs/factory/decisions.md), [`roadmap.md`](docs/factory/roadmap.md) |
| Vision et exigences de **ThreadStep**, pas de l'ASF | [`docs/product/vision.md`](docs/product/vision.md), [`docs/product/mvp.md`](docs/product/mvp.md) |
| Tâches de l'application et statuts | [`backlog/README.md`](backlog/README.md), [`backlog/tasks/`](backlog/tasks/), [`backlog/tasks/TEMPLATE.md`](backlog/tasks/TEMPLATE.md) |
| Spécifications fonctionnelles **effectives** | [`openspec/specs/`](openspec/specs/) ; historique dans [`openspec/changes/archive/`](openspec/changes/archive/) |
| Comportement effectivement exécuté | [`site/`](site/), [`tests/`](tests/), [`.github/workflows/`](.github/workflows/), [`scripts/`](scripts/) |

**Important :** ce qui a été « implémenté », « fusionné » ou « testé »
se confirme avec les fichiers de la branche concernée **et les états
réels des PR et runs GitHub**. Les plans, checklists historiques et
anciennes conversations ne sont pas des preuves de livraison.
Au début d'une mission, vérifier `main`, les PR ouvertes, les runs
récents et la politique de protection, car cette table des matières
ne donne aucune garantie de fraîcheur.

## 3. Identifier le travail demandé

**A. Besoin fonctionnel pour ThreadStep (ou un autre produit pilote)**

1. Lire vision, exigences MVP, code, spécifications canoniques et
   backlog existant ; éviter de créer un doublon.
2. Choisir le **prochain identifiant `TS-NNN` libre** après vérification
   des fichiers *et des branches/PR ouvertes* ; ne pas deviner
   le prochain numéro à partir de cette page.
3. Rédiger `backlog/tasks/TS-NNN.md` selon
   [le modèle](backlog/tasks/TEMPLATE.md) et le
   [contrat de tâche V2](docs/factory/backlog-v2-task-contract.md) :
   frontmatter `schema_version: 2` (`id`, `type`, `status`, `priority`,
   `automation`, `risk`, `depends_on`, `created_at`) puis valeur
   utilisateur, comportements observables, critères vérifiables,
   persistance, sécurité/accessibilité/mobile si pertinentes, tests,
   dépendances, hypothèses et exclusions. Valeurs par défaut :
   `automation: allowed` pour une tâche produit complète et bien
   caractérisée ; `status: ready` si les critères de préparation sont
   remplis, sinon `proposed`, sans seconde promotion ; `risk: unknown`
   si le risque n'est pas caractérisé. `risk: unknown` n'est jamais
   `low` et n'autorise aucune exécution automatique ; une
   contre-indication explicite (`type: factory`, risque `medium`/`high`/
   `unknown`, tâche historique sans `automation`) prime sur ce défaut.
   `TS-NNN` reste propre à ThreadStep ; les tâches de factory utilisent
   des identifiants `ASF-*` avec `Automation: manual`. Créer ou planifier
   une tâche n'autorise ni coût, ni fusion, ni modification de workflow,
   de secret, de permission ou de code.
4. Mettre à jour `backlog/README.md` et la documentation
   produit pertinente si nécessaire. Créer une **branche et une PR
   documentaire** pour rendre la tâche disponible sur `main`.
5. Si l'utilisateur autorise la fusion, vérifier la CI sur le **SHA
   exact de la PR** puis fusionner via GitHub sans contourner
   `Protect Main`. Vérifier CI de `main` et Pages après fusion.
6. Ne **pas** lancer automatiquement l'agent de développement pour
   la seule création d'une tâche. Le propriétaire décide
   indépendamment du lancement OpenRouter/OpenSpec.

**B. Implémenter une tâche déjà définie**

- Relire la tâche et vérifier qu'elle est réellement **prête, non déjà
  livrée et compatible avec l'état courant** ; consulter la PR ouverte,
  une branche agent persistante et l'archive OpenSpec avant de relancer.
- L'agent de développement ne travaille jamais directement sur `main`.
  Pour une évolution fonctionnelle, préférer le workflow OpenSpec
  documenté ci-dessous. Il prépare le plan, implémente, vérifie, met
  à jour les specs canoniques et archive ; une **PR distincte** livre
  le résultat. Vérifier les faits après exécution.
- Ne pas confondre une PR de **plan** (brouillon) avec une PR de code
  finalisable ; ne pas fusionner un plan pour essayer de faire
  progresser `apply`.
- Si aucun outil de lancement de workflow n'est disponible dans la
  session ChatGPT, **ne pas prétendre l'avoir lancé**. Fournir plutôt
  le lien Actions et les paramètres, ou utiliser un outil
  explicitement autorisé s'il existe.

**C. Faire évoluer la factory elle-même**

- Lire [les règles ASF](docs/factory/README.md), la sécurité,
  les décisions et la roadmap. Une évolution de workflow,
  d'authentification, de CI, d'OpenSpec ou de politique de fusion est
  distincte d'une fonctionnalité de l'application.
- Créer une **tâche documentaire dédiée** sous
  `docs/factory/tasks/` dans **la même PR** que le changement,
  avec critères, risques, preuves et limites. Mettre à jour
  l'état courant, la méthode, l'architecture et/ou les ADR
  affectés ; suivre le contrat dans `AGENTS.md`.
- Faire valider la syntaxe Actions et des scripts, le périmètre et
  la CI. Un workflow modifié mais non vérifié peut ne plus apparaître
  normalement dans GitHub Actions. Ne jamais assouplir les protections
  simplement pour faire passer une PR.

**D. Réconciliation ou maintenance documentaire**

- Comparer documentation, code sur `main`, tâches, specs, PR fusionnées
  et runs réels. Créer une tâche documentaire traçable
  (p. ex. sous `docs/factory/tasks/` ou `docs/product/tasks/`),
  puis une PR contenant exclusivement les modifications nécessaires.
- Corriger les statuts obsolètes **sans cocher rétroactivement**
  une checklist historique. Garder les incidents passés identifiables
  et séparer « fait », « prouvé par CI » et « encore à tester ».
- Fusionner seulement si l'utilisateur l'a **explicitement autorisé**
  pour cette tâche et que les contrôles requis sont réussis.

## 4. Quels workflows existent ?

**Lire leur YAML sur la branche de base courante avant de renseigner
les paramètres : les options, modèles et valeurs par défaut peuvent changer.**

| Action GitHub | Définition (source de vérité) | Rôle |
| --- | --- | --- |
| **Agent (manual, OpenRouter)** | [`.github/workflows/agent.yml`](.github/workflows/agent.yml) | Implémentation directe depuis le backlog, **sans OpenSpec**. Tâche au format complet, modèle et option de fusion. |
| **Backlog Orchestrator V1 (owner, bounded wave)** | [`.github/workflows/backlog-orchestrator.yml`](.github/workflows/backlog-orchestrator.yml) | `dry-run` gratuit ou `execute` explicitement autorisé ; `max_tasks=1|2`, une tâche à la fois, preuve de CI/Pages post-fusion entre tâches. |
| **Agent OpenSpec (manual, staged or auto)** | [`.github/workflows/agent-openspec.yml`](.github/workflows/agent-openspec.yml) | Développement spec-driven : `plan`, `apply`, `auto`, `finalize`. Normalisation des numéros courts (`11` → `TS-011`) si cette capacité reste activée dans le YAML. |
| **CI** | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | Contrôle indépendant sur PR et `main` : tests, syntaxe GitHub Actions, validation OpenSpec. Ne lance pas OpenRouter. |
| **Pages** | [`.github/workflows/pages.yml`](.github/workflows/pages.yml) | Vérifie puis publie le site statique depuis `main`. |

Page des workflows : https://github.com/cedricmenec/threadstep/actions

Pour la procédure pratique et les avertissements de coût,
**lire [`openspec-manual-pilot.md`](docs/factory/openspec-manual-pilot.md)**.
Un lancement `auto` peut enchaîner plusieurs appels OpenCode/OpenRouter
payants ; aucun plafond USD n'est garanti par la seule durée du job.
Les secrets demeurent dans GitHub (`OPENROUTER_API_KEY`,
`APP_PRIVATE_KEY`, variable `APP_ID`) et ne doivent jamais
être demandés en clair à l'utilisateur.

## 5. PR, contrôles et fusion : méthode sûre

1. Créer une branche dédiée depuis `main`, modifier **seulement** les
   fichiers autorisés, committer et ouvrir une PR vers `main`.
2. Inspecter le diff et l'état réel de la PR ; vérifier l'absence
   de secrets, de changements hors périmètre et de conflits.
3. Attendre la **CI `check` indépendante et obligatoire**, vérifiée
   pour le SHA actuel de la PR. Lire les logs si échec ; ne jamais
   annoncer « tests réussis » sur un simple statut en cours.
4. Fusionner **uniquement sur autorisation explicite** de l'utilisateur,
   sauf si celui-ci a autorisé l'activation de l'auto-merge pour le
   **run précis** ou la livraison en cours.
5. Pour les deux workflows agents, la case GitHub `auto_merge` peut
   demander une fusion native différée **des PR finales seulement** :
   `scripts/request-safe-auto-merge.mjs` doit confirmer un ruleset
   actif imposant PR et `check`. **OpenSpec `plan` n'est jamais
   auto-mergé.** Ne pas lancer `gh pr merge --admin`, faire de push
   direct ou contourner un contrôle requis.
6. Contrôler ensuite la CI sur le commit fusionné et le déploiement
   Pages. Rendre compte des liens PR/runs et du statut réellement
   confirmé ; laisser en attente ce qui ne l'est pas.

**Distinction essentielle :** la capacité GitHub d'exécuter
`workflow_dispatch`, de modifier les règles du dépôt, de gérer les
secrets ou d'ouvrir une PR dépend **des outils et permissions effectivement
connectés à la nouvelle session**. Ne pas supposer qu'un nouvel agent
ChatGPT dispose des mêmes accès que celui ayant rédigé ce fichier.

## 6. Reprise, incidents et limites

En cas d'échec, relever le workflow, la phase, le `task_id`,
le modèle, les URLs de run/PR, le SHA, le dernier commit distant,
l'état de la checklist et le répertoire OpenSpec actif/archivé.
Reprendre à partir **des faits GitHub**, sans dupliquer une branche,
une tâche, un change déjà archivé ni rejouer un appel payant
sans autorisation.

Une checklist OpenSpec `tasks.md` ne peut contenir de cases
imposant d'observer **après** la synchronisation OPSX, l'archivage
ou la CI distante : ces vérifications appartiennent à une section
post-sync **sans cases**, sinon la validation bloque `apply`.
Se référer à [la procédure OpenSpec](docs/factory/openspec-manual-pilot.md).

Pour connaître la situation réelle, y compris les limitations
(open-source/pilote, budgets, couverture de tests, orchestrateur
de vagues, reproductibilité), relire
[`docs/factory/current-state.md`](docs/factory/current-state.md).
Les leçons des anciennes PR et incidents doivent rester visibles,
mais leurs anciennes conclusions ne doivent jamais supplanter
une vérification actuelle.

## 7. Premier message utile dans une nouvelle conversation

> « Lis `ChatGPT.md` à la racine de
> `cedricmenec/threadstep`, puis `AGENTS.md` et
> `docs/factory/current-state.md`. Vérifie les PR,
> workflows et contrôles GitHub actuels. Explique
> brièvement l'état constaté et traite ensuite ma demande :
> … »

**Résumé opérationnel :** comprendre la demande → lire les
sources de vérité → vérifier l'état GitHub → agir seulement
dans le périmètre autorisé → PR → CI indépendante →
fusion si autorisée → vérifier `main` / Pages → fournir
preuves et limites. Pour un **autre projet pilote**, remplacer
les chemins et règles métiers de l'application, mais conserver
les invariants de sécurité et de traçabilité de la factory.
