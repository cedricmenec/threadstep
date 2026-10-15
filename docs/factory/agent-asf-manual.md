# Exécuteur manuel des tâches ASF (ASF-BOOT-001)

**Statut :** proposé en PR, non activé avant fusion et contrôles.

## Entrée distincte

`.github/workflows/agent-asf.yml` ajoute `Agent ASF (manual, OpenRouter, reviewed PR)` ; ne remplace ni `agent.yml` ni `agent-openspec.yml`. Il reconnaît les identifiants `ASF-V2-001` à `ASF-V2-011`, sur `main`, déclenchés par le propriétaire du dépôt ; **ASF-V2-008/009 sont volontairement refusées avant toute dépense**, car elles portent sur des workflows sensibles. La liste et les chemins sont fixés dans `scripts/agent-asf-policy.mjs`. Les tâches autres que celles répertoriées exigent une nouvelle modification documentaire et de politique après revue.

## Déroulement

1. Le propriétaire examine la tâche et ses dépendances livrées, puis lance `Run workflow` avec un ID et un modèle OpenRouter explicites. Ce clic autorise une exécution payante, et aucune autre.
2. Le précontrôle refuse les tâches non prêtes, sans `Automation: manual`, avec dépendances non prouvées dans leurs Markdown, ou déjà sujettes à une PR ouverte. Une dépendance livrée exige `Status: completed` (ou `delivered`) et `Delivery proof: https://github.com/.../pull/N`. La vérification de la fusion réelle est encore humaine dans ce bootstrap.
3. Le job `develop` installe OpenCode et reçoit la clé OpenRouter pendant l'étape payante seulement. Il n'a pas de jeton GitHub App ni de permissions d'écriture ; son diff est contrôlé et transporté comme patch de taille bornée.
4. Le job `publish` repart du SHA de départ, copie la politique approuvée dans un chemin hors patch, applique le patch, le contrôle avec cette copie **approuvée sur main**, puis seulement crée un jeton GitHub App à portée limitée pour pousser une branche dédiée et ouvrir une PR **sans auto-merge**.
5. Le propriétaire examine la PR, les diff, la CI indépendante et autorise séparément la fusion. Après livraison, la tâche ASF doit être réconciliée sur main avec son statut et la preuve GitHub pour débloquer les suivantes.

## Protections et restrictions

- Le workflow ASF ne peut pas être déclenché par un tiers ni depuis une branche d'implémentation ; le modèle n'a pas d'autorité pour décider de la tâche ou de ses chemins.
- Une branche différente est créée à chaque run (suffixe GitHub run ID), les PR ouvertes bloquent normalement un second lancement du même ID. En cas de doute sur l'état GitHub, ne pas relancer sans diagnostic humain.
- Les modèles disponibles réutilisent les choix OpenRouter du workflow existant, sans budget financier exécutable. Pas de retry automatique.
- Les fichiers `scripts/agent-asf-policy.mjs` et **tous les fichiers** de `.github/workflows/` sont interdits aux modifications d'agent dans le bootstrap. Les tâches 008/009 sont suspendues pour une voie d'implémentation et de publication séparée avec revue préalable.
- GitHub exige une permission App spécifique `Workflows: write` pour pousser des fichiers `.github/workflows/`. Le bootstrap **ne la demande pas** et bloque ces modifications avant l'agent : aucune évolution de permission ou secret n'est incluse.
- Les actions en contexte `publish` ne lancent jamais de scripts de projet ou du code non approuvé après application du patch. Le modèle et son contenu sont non fiables ; la revue humaine demeure indispensable.
- Le précontrôle documentaire de dépendance ne remplace pas la vérification réelle de PR/CI/merge. Le futur `ASF-V2-007` apportera un vérificateur GitHub pour cet usage.
- Refus de travailler si un test échoue ou si le diff sort de la politique. Aucune fusion automatique et aucun contournement de `Protect Main`.

## Contrôles à réaliser sur la PR bootstrap

Vérifier `npm run check`, le job indépendant `check`, Actionlint, la syntaxe Bash des blocs YAML et les limites des tests de politique. L'apparition du workflow dans Actions après fusion n'est pas la preuve d'un run payé réussi. La première exécution payante doit être autorisée séparément sur ASF-V2-001.

Documentation historique : [tâche de bootstrap](tasks/ASF-BOOT-001.md), [plan ASF-V2](tasks/ASF-V2-README.md), [architecture validée](specs/README.md).
