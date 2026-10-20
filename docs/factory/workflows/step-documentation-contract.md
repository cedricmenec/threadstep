# Contrat de documentation d'un workflow et de chaque step ASF

**Statut : norme documentaire proposée, sans effet sur l'exécution.**

## 1. Fiche workflow, orientée lecteur fonctionnel

Répondre sans ouvrir le YAML : **dans quel cas l'utiliser, qui peut l'activer, combien d'actions payantes peut-il déclencher, quel résultat espérer, comment reconnaître l'échec et quoi faire après ?**

Champs obligatoires : nom UI, chemin source et référence SHA/version, objectifs, type de tâche, déclencheurs/événements, acteur autorisé, paramètres (types, valeurs et sens), politiques de coûts, règles de concurrence, permissions/globales, dépendances GitHub/App/secrets **nommés**, jobs ordonnés et diagramme, effets de bord (branche, artefact, journal, PR), état de succès et d'arrêt, non-régression et preuves.

Distinguer `workflow_dispatch` direct de `workflow_call` et des déclencheurs automatiques (`push`/`pull_request`). Ne jamais assimiler l'existence d'un secret à sa valeur, ni un modèle par défaut à une autorisation payante.

## 2. Fiche job, orientée architecture technique

Pour **chaque** job YAML : ID exact, `needs`, condition `if` et ordre effectif, `runs-on`, `timeout-minutes`, `permissions`, `concurrency`, environnement/secrets, entrées et sorties de jobs, rôle fonctionnel, responsabilité technique, interactions externes et conséquences d'un échec/skipped/cancelled. Signaler explicitement un lock que le parent ne doit pas acquérir.

## 3. Fiche step, à granularité YAML exacte

Pour **chaque** élément de `jobs.<job>.steps`, dans son ordre YAML, sans renommer arbitrairement les steps qui n'ont pas de `name` :

| Champ obligatoire | Question à laquelle le lecteur doit pouvoir répondre |
| --- | --- |
| Identité et position | Quel job, index de step, `name` ou action `uses`, lien YAML ? |
| Intérêt fonctionnel | Pourquoi cette étape est-elle nécessaire au scénario utilisateur ? |
| Comportement technique | Action externe et version **ou** commande/script, fichiers lus/écrits, effets réseau et sous-processus ? |
| Préconditions / `if` | Quels événements, paramètres, résultats ou états la rendent exécutable ? |
| Entrées / sorties | Variables et contexts, outputs `GITHUB_OUTPUT`, artefacts, branches, PR, journal, SHA ? |
| Permissions / secrets | Quels droits minimaux et noms de secrets, contexte fiable ou non fiable ? |
| Échecs / arrêt | Qu'est-ce qui peut échouer ? Qu'est-ce qui bloque alors ? Quelle preuve conserve-t-on ? |
| Validation / importance | Quel test, quelle propriété de sécurité ou quel critère d'acceptation échouerait si l'étape était retirée ? |

Un résumé par job **ne remplace pas** les lignes dédiées à ses steps. Des steps portant `uses:` sont documentés autant que les scripts `run:`.

## 4. Diagrammes et liens de preuve

- Diagramme de jobs reprenant les `needs` et conditions réels, pas une intuition narrative.
- Diagrammes de séquence utilisateur, contrôleur, exécuteur, GitHub Actions, GitHub API/App, OpenRouter, CI et Pages lorsqu'il y a plusieurs participants.
- Lien vers les modules de code, leurs tests, et les preuves de run/PR/CI disponibles. Ne jamais cocher une validation sur la seule présence d'un test dans le dépôt.
- Séparer comportement **en service**, limitation constatée, comportement **proposé**, incident **historique** et preuve seulement **simulée**.

## 5. Revue de dérive et critères de qualité

Comparer la liste ordonnée extraite du YAML (workflow, jobs, steps, `if`, `needs`, `permissions`, `uses` et `run`) à la documentation avant fusion. En cas de changement de step, de token, de politique ou d'interaction : revue documentaire obligatoire dans la même PR. Un futur contrôle automatisé pourra détecter la dérive, mais il n'est **pas implémenté** dans cette PR.

Critère de lisibilité : une personne qui découvre ASF doit pouvoir raconter le chemin du clic jusqu'à la PR, la CI, la fusion et le déploiement, puis expliquer pour chaque step son objectif et sa condition d'arrêt, sans interpréter directement le YAML.
