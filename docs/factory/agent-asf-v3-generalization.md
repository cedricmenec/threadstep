# ASF V3 : généralisation de l'Agent ASF sans auto-extension de privilèges

**Statut : conception proposée, non implémentée.** [Fiche ASF-V3-EXEC-001](tasks/ASF-V3-EXEC-001.md). Cette spécification n'autorise pas l'Agent ASF actuel à traiter une tâche V3.

## 1. Constat vérifié : pourquoi un exécuteur séparé de l'agent produit

| Aspect | `agent.yml`, agent produit direct | `agent-asf.yml`, agent factory V2 |
| --- | --- | --- |
| Tâches | `TS-NNN` issues du backlog produit | `ASF-V2-001..011` explicitement connues |
| Orchestration interne | Un job `develop` pour code, tests et PR | Jobs `preflight`, `develop`, `publish` indépendants |
| Accès d'écriture pendant le code modèle | Le job récupère un token App utilisé pour publier | **Aucun token App d'écriture dans le job du modèle** |
| Publication | PR pouvant demander auto-merge GitHub conditionnel | PR sans auto-merge, revue humaine systématique |
| Politique fichiers | Protège les chemins internes factory | Allowlist spécifique à chaque tâche + exclusion inconditionnelle des workflows/politique |
| Historique V2 sensible | N/A | ASF-V2-008/009 bloquées par le bootstrap ; voie humaine séparée |

Sources : [workflow produit](../../.github/workflows/agent.yml), [workflow ASF](../../.github/workflows/agent-asf.yml), [politique ASF](../../scripts/agent-asf-policy.mjs), [dépendances](../../scripts/verify-asf-dependencies.mjs), [mode opératoire](agent-asf-manual.md) et [documentation step par step en PR #67](https://github.com/cedricmenec/threadstep/pull/67).

## 2. Couplages V2 à retirer de manière contrôlée

- `scripts/agent-asf-policy.mjs` contient une table `policies` figée par `ASF-V2-001..011` et `knownTask()` accepte uniquement le motif de phase V2.
- `preflight()` et la validation de dépendances résolvent directement `docs/factory/tasks/<ID>.md` et les IDs reconnus par la politique.
- Le prompt du job `develop` demande explicitement de lire `ASF-V2-NNN.md` ; la description du formulaire mentionne V2.
- `validateChangedPaths()` refuse déjà le fichier de politique, tous les workflows et les modifications de fiches autres que la tâche active. Ces protections doivent **rester**.
- `agent-asf.yml` conserve le job modèle sans permission d'écriture, l'artefact de patch limité à 1,5 Mo, un second précontrôle avant token App et l'absence d'auto-merge.
- Le vérificateur de dépendances GitHub comporte des preuves historiques particulières pour les livraisons sensibles ASF-V2-008/009. Ne pas transformer ces exceptions épinglées en règle générale de confiance.

## 3. Principe cible : registre de politiques approuvé, jamais contrôlé par l'agent

Séparer trois données :

1. **Tâche déclarative** : ID versionné `ASF-...`, `Status`, `Type: factory`, `Automation: manual`, dépendances, objectifs, critères et périmètre fonctionnel.
2. **Politique d'exécution de confiance** : registre revu et versionné sur la branche approuvée, mappant chaque tâche éligible vers un profil et des chemins *précis*. L'agent ne peut modifier ni le registre ni la mécanique de validation.
3. **Autorisation réelle** : clic explicite du propriétaire sur `main`, provenance/attempt vérifiés, résultats des dépendances confirmés indépendamment par GitHub, absence d'exécution ou PR contradictoire.

Une tâche `ready`, un changement de texte dans la fiche, un profil nommé dans le prompt ou une PR documentaire ne peuvent jamais élever les permissions. Le registre doit être immutable au moment de la génération et revalidé sur le SHA fiable pendant la publication. L'allowlist s'applique à chaque chemin modifié, et les exclusions absolues priment sur les chemins préfixes.

Un contrat d'ID générique ne doit pas signifier « accepter tous les `ASF-*` ». Prévoir une grammaire d'identifiant strictement validée, un registre à entrées exactes, une règle d'unicité et un statut de disponibilité explicitement approuvé. Les phases ASF-V3 et suivantes peuvent être ajoutées **par PR de politique revue**, sans modifier le moteur central à chaque fois.

## 4. Profils de sécurité envisagés

| Profil | Exemple de fichiers autorisables sous registre approuvé | Publication |
| --- | --- | --- |
| `factory-docs` | Fiche factory sélectionnée et sous-ensemble explicitement nommé de `docs/factory/` | Même garde-fou patch ; PR revue |
| `factory-code` | Sous-ensemble précis de `scripts/asf/`, `tests/` et documentation dédiée | Même frontière `develop/publish`, jeton App normal après validation |
| `factory-sensitive` | `.github/workflows/`, vérificateurs de permissions, politique, authentification, secrets/rulesets | **Refus par Agent ASF standard** ; processus séparé, humain, préalablement autorisé, revue et publication contrôlées |

Les profils ne sont **pas** des droits GitHub. L'Agent ASF ordinaire conserve `contents: read` durant le développement et le token App d'écriture limitée pendant `publish`, après vérification. L'ajout d'une permission `Workflows: write`, de droits de dispatch ou d'une capacité de changer des secrets n'est ni automatique ni demandé ici.

Une évolution d'un fichier de sécurité ne doit pas être facilitée en plaçant simplement `.github/workflows/` dans une allowlist. Si une voie assistée est un jour envisagée, son évaluation, son contexte de publication et son approbation doivent être définis **avant** son activation, dans une PR sensible dédiée.

## 5. Déroulement futur proposé (sans changer le workflow courant)

1. `preflight` : valider actor, `main` et tentative, tâche/phase reconnue, politique approuvée, dépendances livrées par preuve GitHub, collisions run/PR, modèle autorisé, périmètre maximal.
2. `develop` : checkout de la source fiable, copie du registre/politique hors espace de travail modifiable par le modèle, OpenCode sans jeton d'écriture, tests, contrôle du patch et artifact borné.
3. `publish` : checkout du **SHA initial**, politique de source fiable avant application, revalidation de l'identité de tâche et de tous les chemins, absence de scripts du patch en contexte privilégié, création tardive du token App, commit sur branche dédiée et PR sans auto-merge.
4. **Livraison** : CI `check` sur SHA exact, revue du diff et des preuves, autorisation de fusion distincte, puis vérification de main et Pages. Le rôle de l'agent se termine à la publication de la PR.

Les jobs `preflight/develop/publish` existants offrent une frontière utile. Ne pas réécrire cette frontière au seul motif de la rendre « générique ».

## 6. Critères négatifs obligatoires

- ID valide syntaxiquement mais absent du registre, ID avec traversal, dépendance inconnue ou non livrée : refus **avant coût**.
- Profil `factory-code` tentant d'éditer `.github/workflows/`, un fichier de politique ou de modifier un symlink : rejet.
- Autorisation falsifiée par un agent, fichier de registre modifié dans le patch ou changement de règle entre vérifications : rejet.
- Re-run du même départ, seconde PR pour la tâche, branche conflictuelle, API GitHub ambiguë : fail-closed, sans retry payant.
- Patch vide, trop volumineux, mauvaise base SHA, mode Git interdit ou test rouge : aucun token App pour publier.
- Modèle ayant besoin d'une permission App `Workflows: write` : mode standard refuse, revue humaine séparée.

Maintenir les tests V2 existants et vérifier que le chemin agent produit et l'exécuteur OpenSpec ne sont pas modifiés par une refonte de politique factory.

## 7. Découpage des PR d'implémentation, après revue de conception

**EXEC-IMPL-A :** introduire un registre de politique versionné et des fonctions pures de validation d'IDs, profils, chemins, dépendances et empreintes. Tests positifs/négatifs. Ne pas modifier `agent-asf.yml` ni demander de nouveaux droits. Ajouter un item de documentation coché dans la même PR.

**EXEC-IMPL-B :** adapter `agent-asf.yml` au registre approuvé et aux IDs V3, avec tests Actionlint/Bash, non-régression, contrôle de provenance et séparation inchangée des jobs. C'est une PR **sensible workflow**, approuvée et publiée par une voie humaine distincte. Ne pas faire passer cette modification par l'Agent ASF bootstrap qui interdit les workflows.

**EXEC-IMPL-C (option future à cadrer) :** proposer une procédure assistée pour les tâches sensibles, mais uniquement avec sa propre revue/autorisation avant toute création d'identifiants privilégiés. Aucune implication que ce composant serait déjà accepté.

Toutes ces PR nécessitent des tests réellement exécutés, des preuves CI sur SHA exact et une autorisation de fusion distincte.

## 8. Décisions encore ouvertes

- Schéma de registre des profils (JSON statique, MJS versionné ou autre) et contrôle d'intégrité cryptographique/SHA fiable.
- Forme canonique et versionnement des IDs `ASF-*` avec compatibilité des références V2 historiques.
- Endroit où appliquer le contrôle anti-replay et comment corréler owner, run, tentative, branche et PR.
- Politique exacte d'intervention humaine pour `factory-sensitive`, particulièrement lors de modifications de fichiers workflow ou de publication.

**Conséquence opérationnelle immédiate :** le workflow Agent ASF V2 actuel continue de refuser les tâches V3. La présente spécification ne le rend pas exécutable et ne donne aucune permission nouvelle.
