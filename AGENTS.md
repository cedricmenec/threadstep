# Contrat de l'agent de développement

## Objet et sources de vérité

`AGENTS.md` définit **les instructions et modes opératoires de l'agent
de coding** : sécurité, lecture du contexte, périmètre des modifications,
tests, publication et reprise. **Il ne définit pas les fonctionnalités,
les non-objectifs ou l'architecture cible du produit.**

- Lire la tâche courante dans `backlog/tasks/`, les exigences applicables
  sous `docs/product/`, les spécifications canoniques `openspec/specs/`
  et le code effectif avant de modifier le produit.
- Distinguer **MVP historique**, **état effectivement livré** et **nouvelles
  exigences approuvées**. Les anciennes restrictions fonctionnelles
  ne doivent pas être traitées comme des prohibitions permanentes.
  Documenter toute transition nécessaire dans le plan OpenSpec.
- Les technologies de persistance, services cloud, mécanismes de compte
  et d'authentification, bibliothèques et parcours utilisateurs sont des
  **choix produit** décrits dans les spécifications et briefs pertinents.
  Ce contrat d'agent ne les autorise ni ne les interdit par défaut :
  l'agent implémente exclusivement la tâche expressément confiée.
- La création et qualification des tâches est régie par
  [ChatGPT.md](ChatGPT.md) et le
  [contrat de backlog V2](docs/factory/backlog-v2-task-contract.md),
  pas par des non-objectifs figés dans ce fichier.

## Sécurité et périmètre d'exécution

- Le dépôt et le site publié sont publics. **Ne jamais committer ni exposer
  de secrets**, clés OpenRouter, jetons, clés d'administration cloud,
  fichiers de configuration sensibles ni données personnelles dans
  les sources, PR, logs ou documentation publique.
- Ne pas insérer des chaînes utilisateur non fiables comme HTML
  exécutable ; appliquer les contrôles prévus par les spécifications
  métier. Vérifier explicitement la sécurité, la confidentialité et
  les frontières de confiance avant tout échange réseau ou partage.
- Préserver les données utilisateurs et les anciens exports/imports,
  ou mettre en place une migration **explicite, non destructive et testée**.
  Ne pas transférer des données héritées vers un service externe
  sans respecter les exigences de consentement du contrat produit.
- Travailler uniquement sur une branche préparée ; **ne jamais pousser
  directement sur `main`**. Ne modifier que les chemins autorisés et
  le périmètre de la tâche.
- Lire tous les critères d'acceptation avant d'éditer. Un brief ou un
  plan `ready` n'autorise ni l'appel payant d'un LLM, ni un déclenchement
  automatique, ni une fusion, ni un changement de secrets. Exiger
  l'autorisation explicite applicable à chaque opération.

## Exécution OpenSpec, contrôles et recette

- Suivre [ASF-OPSX-01](docs/factory/openspec-checklist-contract.md).
  Chaque case de `tasks.md` DOIT être une action d'implémentation
  ou un test que le runner peut effectivement exécuter et démontrer
  durant `apply`, **avant OPSX sync et archivage**. Couvrir aussi
  les critères d'acceptation qui nécessitent une recette humaine,
  sans les transformer en cases impossibles à cocher.
- Placer la recette manuelle (visuelle, clavier, tactile, mobile,
  lecteur d'écran et autres tests non automatisables) dans
  `Manual acceptance` **sans cases à cocher**.
- Placer la revue après sync (diff sémantique, archivage, CI
  indépendante, fusion, Pages) dans `Post-sync review` **sans
  cases à cocher**. Ces validations restent nécessaires au rapport
  final, mais ne bloquent pas artificiellement `apply`.
- **Ne pas bloquer une tâche dépendante faute de GO/rapport de recette humaine
  de la tâche précédente.** Une PR précédente fusionnée avec CI indépendante,
  CI `main` et déploiement Pages réussis suffit pour la dépendance technique.
  Garder la recette sur appareil dans `Manual acceptance` avec son état réel
  (non effectuée/non attestée si nécessaire), sans créer de PR d'attestation
  obligatoire ni demander au modèle d'inventer des résultats. Une **décision
  produit explicite** (maquette, sécurité, consentement, arbitrage fonctionnel)
  reste requise lorsqu'elle est véritablement nécessaire au nouveau périmètre.
- Exécuter `npm run check` et les tests liés à la tâche ; préciser
  ce qui a réellement été vérifié. Ne jamais présenter une
  vérification non effectuée comme réussie.
- Ne pas fusionner directement de PR ni contourner les contrôles.
  Les workflows owner-dispatched peuvent demander l'auto-merge
  **natif GitHub** pour une PR finale si le ruleset de `main`
  exige effectivement le check indépendant `check` sur son SHA.
  Ne jamais auto-fusionner une PR OpenSpec `plan`. Sur protection
  absente ou ambiguë : échec fermé et PR ouverte.

## Modifications protégées de la factory

- **Un agent de développement produit ordinaire ne change pas**
  `AGENTS.md`, les workflows, identifiants, secrets,
  `opencode.json`, scripts de sécurité ou fichiers protégés ASF.
  Toute évolution de la factory nécessite une **PR distincte,
  explicitement autorisée et revue**.
- Toute PR concernant la factory (politique d'agent, GitHub Actions,
  OpenCode/OpenSpec, sécurité, livraison, coûts ou permissions) DOIT
  inclure une **tâche ou checklist documentaire dédiée** dans la même PR,
  avec mise à jour des guides `docs/factory/` concernés ou
  justification précise du caractère inutile de ces changements.
  Distinguer état implémenté, tests réalisés et hypothèses.
- L'agent ASF manuel reste un chemin owner-only distinct : allowlist
  versionnée, pas de jeton GitHub App en écriture dans l'exécution
  du modèle, et PR revue humainement sans autorisation de fusion
  implicite. Voir [agent-asf-manual.md](docs/factory/agent-asf-manual.md).
- Le workflow OpenSpec initialise et vérifie ses commandes/skills
  sur le runner éphémère avant les appels payants. La synchronisation
  doit employer la commande OPSX native et son garde-fou de fichiers ;
  les opérations REMOVED/RENAMED n'ont pas encore de preuve E2E.

## Checkpoints et reprise contrôlée

Le workflow OpenSpec pousse sur `agent/openspec/TS-NNN` un checkpoint
de **plan validé** avant `apply`, puis un checkpoint de
**code vérifié** avant la synchronisation sémantique. Chaque étape
respecte les vérifications et la portée permise ; un checkpoint
ne constitue ni une livraison ni une autorisation de fusion.

En cas d'échec, utiliser le dernier checkpoint distant attesté
et [la procédure de reprise](docs/factory/validation-and-recovery.md).
La reprise payante via `apply` (depuis plan) ou `finalize` (depuis
code) exige une **nouvelle autorisation explicite**. Ne jamais
réinitialiser un journal incertain ou relancer automatiquement
des appels payants. Valider les spécifications canoniques avant
l'archive ; conserver les preuves des contrôles.

Guides : [ASF développeur](docs/factory/developer-guide.md) ·
[orchestration](docs/factory/backlog-orchestrator-manual.md) ·
[validation et reprise](docs/factory/validation-and-recovery.md).
