# Backlog ThreadStep

## Expérience de chargement de Mes projets : TS-052 (22 octobre 2026)

- **[TS-052](tasks/TS-052.md)** : éviter le clignotement des états transitoires Dexie sur Overview. Diagnostic natif conservé en arrière-plan ; loader discret uniquement si les projets ne peuvent pas encore être lus ; message stable et lien Synchronisation pour une anomalie réellement actionnable. `ready / manual / medium`, priorité haute ; dépend de TS-043 et préserve les protections de TS-045/TS-048. Le clignotement provient plausiblement de `buildDiagnosticSummary()`/`applySyncSummaryVisibility()` ; reproduction sur appareil encore à confirmer.
- La tâche ne modifie pas Dexie, le contrôle d'accès ou la factory. Son implémentation exige un lancement OpenSpec manuel, une CI indépendante et une recette Chrome Android.

## Assistance au diagnostic de synchronisation : TS-051 (21 octobre 2026)

- **[TS-051](tasks/TS-051.md)** : ajouter dans Paramètres > Synchronisation un bouton pour copier un rapport structuré et expurgé, utilisable même pendant une restauration de session bloquée. `ready / allowed / low`, priorité haute ; dépend de TS-043. Le rapport est local, sur action explicite, sans email, OTP, jeton ni contenu métier ; la correction de la restauration demeure suivie par TS-045/TS-048.
- Le cas Android du 21 octobre (session loading, connexion en cours, pull en attente, preuve distante bloquée) est un scénario de recette obligatoire. La présente PR reste documentaire, sans appel LLM, sans diagnostic à distance et sans modification de la synchronisation.

## Continuité UX : TS-049 et TS-050 (20 octobre 2026)

- **[TS-049](tasks/TS-049.md)** : stabiliser le scroll et le focus pendant création, complétion, édition et réordonnancement, sans navigation ni saut intempestif. `on_hold / manual / low`, priorité haute ; PR de code #161 et #163 fusionnées, recette Android/scroll réelle et réconciliation OpenSpec restantes. Ne pas relancer l'agent automatiquement.
- **[TS-050](tasks/TS-050.md)** : préserver les sous-tâches volontairement ouvertes lors des mises à jour locales, événements Dexie Cloud et inter-onglets, avec reset uniquement sur vraie entrée de vue/reload/import. `ready / manual / medium`, priorité haute, à coordonner avec TS-048.
- **Contrat cible :** `openspec/specs/ux-interaction-continuity/spec.md` (PR documentaire distincte). La présente PR décrit les travaux, **ne change aucun code produit**, ne déclenche aucun run payant et n'atteste aucune recette navigateur.

## Incident : TS-048, projets invisibles malgré un compte lié (20 octobre 2026)

- **[TS-048](tasks/TS-048.md)** : correctif prioritaire de reprise du chargement des projets après un changement transitoire de liaison, avec protection contre les lectures asynchrones périmées et suppression des faux diagnostics « données masquées ». `ready / manual / high`, priorité critique. Le mot `recovery` dans la base indique une copie locale isolée, pas une nouvelle base distante.
- La régression est **reproductible dans le code**, mais la cause exacte de l'incident observé sur Android et laptop reste à confirmer par vérification des tables locales `subjects` et `items`. Le statut `in-sync` ne constitue pas une preuve de convergence des projets.
- Aucun effacement, transfert ou récupération automatique n'est autorisé ; la recette Android/laptop et la comparaison avec la base Dexie Cloud de test restent obligatoires avant de considérer l'incident résolu.

## Confiance dans les données : TS-045 à TS-047 (20 octobre 2026)

Après deux incidents de cache Cloud non vérifié (Android puis laptop), la récupération explicite dans un nouveau cache isolé a permis de retrouver les projets, mais **la cause de réapparition de l'état non vérifié n'est pas démontrée**. Le nom d'un cache `threadstep-ws-*` ou `threadstep-recovery-*` désigne une IndexedDB **locale** ; ce n'est pas la création d'une nouvelle base distante Dexie Cloud. La synchronisation utilise une copie locale IndexedDB et une instance distante, dont l'état et la présence des données ne se prouvent pas par le seul statut natif `in-sync`.

- **[TS-045](tasks/TS-045.md)** : reproduire et corriger les régressions d'identité de cache, reprise OTP/session et visibilité multi-appareils, tout en conservant les caches historiques. `ready / manual / high`, priorité critique.
- **[TS-046](tasks/TS-046.md)** : guide utilisateur clair du modèle local-first, de toutes les copies de données, des transitions local↔Cloud, sauvegardes et scénarios d'incident. `ready / allowed / low`, priorité haute, documentaire uniquement.
- **[TS-047](tasks/TS-047.md)** : interface de confiance de synchronisation, vue immédiate du stockage actif, état authentification/réplication, date fiable d'observation (ou absence de preuve), aides naturelles et actions guidées sans automatisme destructeur. `ready / manual / medium`, priorité haute, après TS-045 et TS-046.

**Découpage et exécution :** TS-045 sécurise la liaison et traite la cause racine avant de masquer la complexité ; TS-046 peut être mené en parallèle, en restant fidèle au code effectivement livré ; TS-047 exploite leurs garanties. Seul TS-046 peut être candidat à Backlog Orchestrator V1 après fusion et précontrôles, **sans autorisation implicite de coût ni de lancement**. TS-045 et TS-047 restent manuels, avec revues et recette réelle Dexie Cloud sur base de test. Cette PR ne modifie que le backlog.

## Interface et paramètres : TS-041 à TS-044 (20 octobre 2026)

Nouveau besoin : menu hamburger et pages dédiées aux sauvegardes et à Dexie Cloud, sans modifier les mécanismes métier déjà livrés. **Cette PR est documentaire : aucun écran n'est encore implémenté et aucun appel OpenRouter n'est déclenché.**

- **[TS-041](tasks/TS-041.md)** : menu hamburger, navigation accessible et routes de paramètres. `ready / allowed / low`, priorité haute ; tâche sélectionnable par Backlog Orchestrator V1 après fusion et vérifications.
- **[TS-042](tasks/TS-042.md)** : déplacer les contrôles existants d'export, import/fusion et restauration vers une page dédiée, sans toucher aux protections de données. `ready / allowed / low`, dépend de TS-041.
- **[TS-043](tasks/TS-043.md)** : page dédiée au diagnostic Dexie Cloud en lecture seule, conservant le pull manuel natif et ses garde-fous. `ready / allowed / low`, dépend de TS-041.
- **[TS-044](tasks/TS-044.md)** : centraliser sur la page de synchronisation configuration, activation, OTP, sélection d'espace, déconnexion et purge locale. `ready / manual / medium`, dépend de TS-043 ; la sécurité des opérations nécessite revue manuelle.

**Orchestration :** V1 sélectionne uniquement les tâches produit `ready / allowed / low` dont les dépendances sont livrées et les autres précontrôles satisfaits. TS-041 peut être candidate d'abord ; TS-042 et TS-043 deviennent candidates après sa livraison vérifiée. TS-044 **n'est pas éligible** automatiquement. Un dry-run sur `main` est nécessaire pour confirmer la sélection effective : les autres tâches et l'état GitHub peuvent influer sur l'ordre. L'ajout des fiches ne constitue ni autorisation de dépense, ni exécution, ni preuve de livraison. La PR ne modifie aucun workflow ASF.


## Cible approuvée : IndexedDB local par défaut, Dexie Cloud facultatif (18 octobre 2026)

Les [huit spécifications OpenSpec cibles](../docs/product/specs/dexie-data-lifecycle-target-v1.md) sont désormais versionnées sous `openspec/specs/` : sept capacités génériques réutilisables (persistance, activation, synchronisation, migration, réconciliation, import/restauration, isolation) et **un profil spécifique ThreadStep**. Elles constituent le **contrat cible approuvé**, pas une preuve que le site actuel l'implémente déjà. Les anciennes spécifications restent traçables et seront réconciliées via les changements OpenSpec de chaque implémentation. [Source de cadrage Notion](https://app.notion.com/p/3fd12ac9163681769406d0e98180b7ef).

- **[TS-032](tasks/TS-032.md)** : base Dexie locale autonome, sans compte ni URL Cloud. `ready / manual / high`, priorité critique.
- **[TS-033](tasks/TS-033.md)** : conversion du V1 `threadstep.document.v1` vers IndexedDB local, sans push Cloud. `ready / manual / high`, priorité critique.
- **[TS-034](tasks/TS-034.md)** : vrai diagnostic Dexie et relance du pull, sans assimiler déconnexion et Cloud vide. `ready / manual / high`.
- **[TS-035](tasks/TS-035.md)** : correction du mapping `legacy:` dans **l'import Cloud** et les réimports JSON, récupération non destructive des données déjà doublement préfixées, export brut des enregistrements orphelins et restauration contrôlée. `ready / manual / high`, priorité **critique** ; incident observé Chrome Android → laptop (5 sujets, 19 tâches dont une orpheline). **Aucune remise à zéro réelle sans sauvegardes vérifiées et consentement.**
- **[TS-036](tasks/TS-036.md)** : réconciliation non destructive avec consentement lié au plan affiché, **correction du panneau de migration V1 et des messages Dexie périmés après restauration/synchronisation réussies**, sans supprimer les données historiques durant cette étape. `ready / manual / high`, priorité critique.
- **[TS-037](tasks/TS-037.md)** : activation Cloud opt-in après usage local, premier transfert explicitement consenti. `ready / manual / high`, priorité critique.
- **[TS-038](tasks/TS-038.md)** : isolation local / instances / comptes, logout et purge maîtrisés. `ready / manual / high`.
- **[TS-039](tasks/TS-039.md)** : recette E2E sur instance de test, Chrome mobile, deux navigateurs, hors ligne et backups. `ready / manual / high`.
- **[TS-040](tasks/TS-040.md)** : décommission définitif du chemin métier `localStorage` V1, **sans maintien du support des anciennes sauvegardes V1** ; auparavant, livrer et vérifier un **nouveau format d'export/import issu d'IndexedDB**, car les exports actuels utilisent encore `version: 1`. Nettoyage des anciennes clés **uniquement volontaire et local**. `ready / manual / high`, après TS-036/037/038/039.

**Ordre prudent :** TS-032 → TS-033 → TS-034 → TS-035 → TS-036 → TS-037 → TS-038 → TS-039 → TS-040 ; les dépendances du frontmatter sont normatives et autorisent certains travaux parallèles. Aucun agent OpenSpec/OpenRouter n'est déclenché par ces briefs. La réussite CI des PR précédentes ne vaut pas recette Dexie Cloud réelle.

## Fiabilisation des migrations Dexie Cloud : TS-031 (18 octobre 2026)

- **[TS-031](tasks/TS-031.md) : reprendre et réconcilier une migration Dexie Cloud sans perte de données.** `ready / manual / high`, priorité critique. Après le correctif de persistance [#127](https://github.com/cedricmenec/threadstep/pull/127), une source V1 peut rester bloquée devant une cible déjà peuplée avec des identifiants divergents. Le brief couvre diagnostic détaillé, décisions explicites par conflit, import partiel non destructif, copies à identifiants stables, contrôle de la première synchronisation distante et reprise idempotente. **État actualisé :** cette tâche a depuis été implémentée par la [PR #130 fusionnée](https://github.com/cedricmenec/threadstep/pull/130), mais la recette Chrome mobile reste bloquée sur « Dexie Cloud n'est pas connecté ». Le nouveau chantier TS-032 à TS-039 traite l'architecture local-first et Cloud optionnel de façon systémique.

*La section datée du 17 octobre ci-dessous est le cadrage historique de TS-024 à TS-030 et ne constitue pas un état de livraison actualisé.*

## Synchronisation Dexie Cloud proposée le 17 octobre 2026 (non implémentée)

[Spécification normative complète](../docs/product/specs/dexie-cloud-local-first.md) · [Architecture et plan de déploiement](../docs/product/dexie-cloud-rollout.md).

- **[TS-024](tasks/TS-024.md)** : Configurer le socle Dexie.js et Dexie Cloud avant l'ouverture. `proposed / manual / high`.
- **[TS-025](tasks/TS-025.md)** : Migrer les opérations métier vers une persistance Dexie local-first. `proposed / manual / high`.
- **[TS-026](tasks/TS-026.md)** : Migrer sans destruction le document historique localStorage V1. `proposed / manual / high`.
- **[TS-027](tasks/TS-027.md)** : Authentifier uniquement par OTP email natif Dexie Cloud. `proposed / manual / high`.
- **[TS-028](tasks/TS-028.md)** : Visualiser la synchronisation et le diagnostic technique. `proposed / manual / medium`.
- **[TS-029](tasks/TS-029.md)** : Séparer changement de base, déconnexion et purge locale. `proposed / manual / high`.
- **[TS-030](tasks/TS-030.md)** : Durcir, tester et documenter la livraison Dexie Cloud. `proposed / manual / high`.

**Constat réel :** ThreadStep utilise actuellement `localStorage`, et non IndexedDB. La migration est donc une tâche explicite ; aucun état historique ne doit être supprimé ni transféré au cloud sans consentement. Les anciennes exclusions cloud/authentification étaient propres au MVP ; `AGENTS.md` a été recentré sur les règles du coding agent et ne fixe plus la cible technique du produit. Ces tâches restent proposées, manuelles et de risque medium/high. Leur ajout ne lance aucun agent payant ni fusion et n'implique pas leur disponibilité en production. Prévoir une livraison cohérente protégeant les données V1.


## Évolutions à développer le 17 octobre 2026 (briefs uniquement)

- **[TS-021](tasks/TS-021.md) : repli initial des sous-tâches.** Chaque ouverture de l'overview ou d'une vue détail présente les enfants repliés ; une expansion volontaire reste valable jusqu'à la prochaine navigation, sans modifier le stockage.
- **[TS-022](tasks/TS-022.md) : promotion d'une sous-tâche en tâche principale.** Changer uniquement sa parenté, préserver identité, contenu, priorité et état, garder les autres enfants liés à leur parent. **Risque modéré / exécution manuelle** en raison de l'impact sur les données.
- **[TS-023](tasks/TS-023.md) : lignes compactes et menu d'actions ⋮.** Réduire la hauteur des commandes, regrouper les opérations, retirer les boutons haut/bas visibles tout en **conservant leur alternative clavier** ; dépend de TS-022. **Risque modéré / exécution manuelle** en raison des enjeux d'accessibilité.

**Note facultative sur une sous-tâche : déjà livrée dans [TS-019](tasks/TS-019.md) via la [PR #89](https://github.com/cedricmenec/threadstep/pull/89).** Le champ `note` et son édition existent pour les deux niveaux, sans nouvelle tâche à créer. TS-017 à TS-020 ont aussi été livrées par les PR #84, #88, #89 et #90 ; leurs textes de préparation ci-dessous reflètent l'état documentaire au moment de leur rédaction, non un état actuel non livré.

Ces trois nouveaux briefs sont **documentaires uniquement** : aucun code produit n'est changé, aucun appel OpenRouter/OpenSpec payant n'est déclenché par leur création. La livraison effective dépend de futurs runs autorisés et de PR distinctes.

## Nouvelles évolutions proposées le 17 octobre 2026 (non implémentées)

- **[TS-017](tasks/TS-017.md) : aperçu de cinq tâches par projet.**
  Limiter chaque carte à cinq tâches principales visibles, sans
  limiter leurs sous-tâches, et ouvrir la page de détail complète
  par « Voir plus ». Préserver les filtres, le tri et les raccourcis
  vers les tâches masquées par cette limite.
- **[TS-018](tasks/TS-018.md) : compteur total en en-tête.**
  Afficher le nombre de tâches **principales**, terminées ou non,
  distinct du compteur existant des étapes en attente et indépendant
  de la limite de cinq.
- **[TS-019](tasks/TS-019.md) : note facultative par tâche.**
  Texte brut multiligne (2 000 caractères maximum) sur une tâche
  ou sous-tâche, avec compatibilité des imports JSON V1 historiques,
  validation et absence de sauvegarde sur annulation.
- **[TS-020](tasks/TS-020.md) : hiérarchie visuelle des tâches.**
  Distinguer clairement tâches et sous-tâches par structure,
  indentation et espacement, sur mobile et desktop, sans changement
  des règles métier.


**Préparation OpenSpec (17 octobre 2026)** : les quatre briefs TS-017 à
TS-020 distinguent désormais critères fonctionnels, sous-tâches
automatisables avant finalisation et recette manuelle post-publication
non cochable. La recette humaine et les checks CI/Pages restent requis
pour la validation réelle, mais ne sont **pas** des cases d'implémentation
qu'un agent devrait prétendre avoir exécutées. Le plan durable de
correction de la factory est consigné dans
[Notion DEV / Projets / ASF](https://app.notion.com/p/3fc12ac9163681e0ba61ca7e6a93a767).
Les briefs seuls ne garantissent pas la qualité d'un futur plan auto :
relire `tasks.md` avant toute phase payante d'implémentation.

Ces quatre fiches sont `product / ready / allowed / low` avec
périmètres bornés et critères de non-régression. Les tâches sont
indépendantes à ce stade et ne créent **aucun agent payant**.
La création/fusion documentaire ne vaut pas autorisation d'exécution
OpenSpec/OpenRouter. Les fonctionnalités ci-dessus ne sont pas encore
implémentées par cette PR.


## Nouvelles tâches proposées le 17 octobre 2026 (non implémentées)

- **[TS-015](tasks/TS-015.md) : modifier la priorité depuis son badge.**
  Le badge « Urgent / Normal / Plus tard » d'une tâche ou sous-tâche
  devient un contrôle de choix rapide et accessible, avec persistance
  dans le document actuel. Le terme « statut » demandé est interprété
  comme la **priorité déjà affichée**, sans créer de statut métier
  distinct de la case « terminée ». État déclaratif :
  `product / ready / allowed / low`.
- **[TS-016](tasks/TS-016.md) : vue de détail d'un projet.**
  Une action sur la carte de la vue d'ensemble ouvre une vue dédiée
  moins dense et navigable par URL, avec tâches et sous-tâches, plus
  **renommage** du projet, tout en conservant le modèle
  `subject` et le stockage local existants. La duplication est
  explicitement **hors périmètre**. État déclaratif :
  `product / ready / allowed / low`, avec risque résiduel borné
  par des tests de navigation, de non-mutation et de régression.
  La sélection automatique reste subordonnée à la présence sur
  `main` et aux contrôles opérationnels du scheduler.

Ces fiches constituent une **préparation documentaire**, pas des
fonctionnalités présentes en production. La PR de backlog n'implémente
pas l'interface. Le déclenchement d'un modèle payant, le lancement
d'une vague, la fusion et tout changement de workflow demandent des
autorisations distinctes. L'index est régénéré avec `npm run backlog:index`
ou son équivalent déterministe.

## Statut de livraison au 16 octobre 2026

Les tâches **TS-012**, **TS-013** et **TS-014** ont été réellement
implémentées et fusionnées via les PR
[#55](https://github.com/cedricmenec/threadstep/pull/55),
[#58](https://github.com/cedricmenec/threadstep/pull/58) et
[#59](https://github.com/cedricmenec/threadstep/pull/59).
Leur présence dans `backlog/index.json` avec `ready/allowed/low` est un
**état déclaratif d'origine**, pas une invitation à les relancer.
Les preuves opérationnelles et le journal `asf/waves/wave-38910657187`
les classent **livrées**. Aucune archive documentaire de ces trois
fiches n'est revendiquée. Les sections « première tâche pilote » et
« deuxième pilote » plus bas décrivent le protocole **historique**
qui a été exécuté, et non des étapes restant à faire.


Les besoins versionnés vivent dans `backlog/tasks/TS-NNN.md`, chaque fichier
portant le frontmatter V2 décrit par le
[contrat des tâches V2](../docs/factory/backlog-v2-task-contract.md) et la
[spécification Backlog V2](../docs/factory/specs/backlog-v2.md). Le contrat de
travail des agents figure dans [AGENTS.md](../AGENTS.md), les exigences dans
`docs/product/` et les spécifications canoniques dans `openspec/specs/`.

## Index généré

`backlog/index.json` (tâches actives) et `backlog/archive-index.json`
(historique archivé) sont des **projections générées**, jamais éditées à la
main. La CI les recalcule avec `npm run backlog:check` et refuse toute
divergence. Pour les régénérer volontairement après une migration ou l'ajout
d'une tâche :

```text
npm run backlog:index
```

## Proposer une fonctionnalité

Exprimer le besoin en langage naturel ou vocal. L'assistant examine
la vision, les exigences et les tâches existantes, choisit un TS-NNN
libre, décompose le travail si nécessaire, écrit le périmètre et
les critères d'acceptation, puis fait valider les documents par PR.
Il n'est pas nécessaire de créer une issue GitHub.

## Exécution effective

- **Direct** : workflow Agent (manual, OpenRouter), avec task_id et modèle.
- **OpenSpec** : workflow Agent OpenSpec (manual, staged or auto), avec
  task_id, modèle OpenRouter et phase plan, apply, auto ou finalize.
  Saisie simplifiée : `9`, `009` et `TS-009` sélectionnent la même
  tâche canonique. Le formulaire pré-sélectionne `auto` et DeepSeek V4.1
  Flash, que l'utilisateur peut modifier avant de lancer le run.
  `auto` effectue normalement trois appels OpenCode payants ; il n'existe
  pas encore de plafond USD automatique. Les exécutions du même TS-NNN sont
  sérialisées ; les tâches différentes peuvent tourner en parallèle.
- **Fusion** : les deux workflows proposent `auto_merge=true` par défaut
  pour leurs PR finales, à condition que `main` impose réellement le check
  indépendant `check` ; sinon la demande de fusion échoue sans fusion.
  OpenSpec `plan` reste systématiquement une PR brouillon non fusionnée.
- **Plan puis apply** : plan génère une PR brouillon de spécifications.
  La conserver ouverte pour revue avant d'exécuter apply sur la branche
  persistante, puis fusionner la PR de livraison après CI. Fusionner la
  seule PR de plan prématurément a provoqué l'incident TS-009.
- **Auto** : exécute les phases dans un seul run explicitement déclenché.
- **OPSX** : init des skills/commandes OpenCode, synchronisation via
  opsx-sync, garde-fou des contenus hors openspec/specs/, archive et
  validation stricte. MODIFIED a été éprouvé sur TS-009.
- **Contrat de phase** : les cases de tasks.md doivent toutes être
  réalisables avant sync ; les contrôles post-sync/CI sont distincts.
- La création d'un backlog ne déclenche pas à elle seule d'exécution
  payante. Les workflows n'ordonnancent aucune tâche et ne fusionnent
  jamais de fusion immédiate sans contrôle : seul GitHub peut fusionner
  automatiquement une PR finale après ses contrôles obligatoires.
  Les plafonds de budget restent à implémenter.

## État du backlog

L'état **déclaratif** (type, statut, priorité, automation, risque,
dépendances, date) est porté par le frontmatter de chaque fichier et projeté
dans `backlog/index.json`. La livraison **opérationnelle** (PR fusionnées, CI,
Pages) reste une observation GitHub consignée dans
[docs/factory/current-state.md](../docs/factory/current-state.md) et dans les
sections « Delivery status verification » des tâches : ni un statut Markdown,
ni une case cochée ne prouvent une livraison.

Les tâches historiques `TS-001` à `TS-011` ont été migrées avec
`automation: manual` et `risk: unknown` : elles ne sont jamais sélectionnées
automatiquement, et leurs cases d'acceptation d'origine restent intactes.
`TS-003` relève de la dette factory, hors éligibilité produit. Détails et
incertitudes dans
[docs/factory/backlog-v2-migration.md](../docs/factory/backlog-v2-migration.md).

La prise en main des fonctions livrées est dans
[le guide d'utilisation](../docs/product/guide-utilisation.md).
L'historique de la factory est dans
[docs/factory/current-state.md](../docs/factory/current-state.md).

## Précautions

Conserver des tâches suffisamment petites pour une seule exécution
bornée. Les priorités et dépendances sont déclaratives : il n'y a pas
encore de moteur d'ordonnancement transactionnel. Ne pas relancer une
tâche déjà archivée uniquement pour « tester OPSX ».

## Première tâche pilote éligible au scheduler (TS-012)

[TS-012](tasks/TS-012.md) décrit le repli/dépli visuel des sous-étapes
existantes, avec des critères testables et **sans modification du stockage**.
Contrairement aux tâches historiques TS-001 à TS-011 (toutes `on_hold`),
son contrat déclare `type: product`, `status: ready`,
`automation: allowed`, `risk: low`, `depends_on: []`.
Cette éligibilité sert au **premier pilote ASF** ; elle n'est ni une
autorisation de dépenses OpenRouter, ni une autorisation de fusion.

Procédure de recette : après fusion de la PR documentaire et CI sur
`main`, lancer `Backlog Orchestrator V1` en `dry-run` avec
`max_tasks=1` et confirmer la sélection de TS-012. Ensuite, demander
séparément l'autorisation du premier `mode=execute`,
`max_tasks=1`, avec coût et fusion contrôlés. Ne pas activer une vague
de deux tâches pour cette seule fiche.

## Deuxième pilote ASF : vague de deux tâches indépendantes

[TS-013](tasks/TS-013.md) — remplacer le texte du bouton de repli par
« Voir N sous-tâches » quand les enfants sont masqués et
« Masquer les sous-tâches » quand ils sont affichés.
La nouvelle tâche est `product / ready / allowed / low`, indépendante
des autres développements en attente (`depends_on: []`).

Une **deuxième PR documentaire** ajoutera TS-014, réordonnancement des
enfants de même parent et de même priorité. Après fusion **des deux PR**,
attendre la **CI et Pages sur le dernier commit de main** avant le dry-run,
puis valider que le scheduler choisit TS-013 avant TS-014.
Ne lancer la vague payante `max_tasks=2` qu'après cette validation
et sur autorisation explicite du propriétaire : `ready` et `allowed`
ne valent pas consentement à payer ou fusionner.

### TS-014 — réordonner les sous-tâches de même priorité

[TS-014](tasks/TS-014.md) ajoute le déplacement tactile/souris et les boutons
« Monter »/« Descendre » pour les enfants **du même parent et de la même
priorité**, sans modifier leur identité ou leur priorité. Le déplacement
persiste dans le tableau `subject.items` existant ; tout drop hors du
groupe est refusé. La tâche est `product / ready / allowed / low`,
avec `depends_on: []` et **sans dépendance envers TS-013**.

Les deux tâches TS-013 et TS-014 sont désormais des candidates pour un
**unique pilote de deux tâches**. Le propriétaire doit attendre CI **et**
Pages réussis sur le commit de fusion de cette PR, puis lancer
`Backlog Orchestrator V1` sur `main` en mode `dry-run` avec
`max_tasks=2`. Le dry-run ne montre que la première sélection ;
le scheduler choisira TS-014 *après* la livraison vérifiée de TS-013.
L'exécution `mode=execute` est payante (quota de départs, pas budget USD)
et requiert une autorisation distincte.
