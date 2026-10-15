# ASF-BL-001 : spécification Backlog V2

**Statut :** approuvée pour découpage en tâches (non implémentée), version 0.1.  
**Produit pilote :** ThreadStep. La convention d'identifiants `TS-NNN` n'est pas une règle générique de la factory.

## 1. Problème et objectif

`backlog/README.md` combine aujourd'hui navigation humaine, méthode et statuts. Les fichiers Markdown détaillés restent nécessaires au travail agentique, mais le choix de la prochaine tâche doit s'effectuer à partir de petites métadonnées structurées, **sans charger les spécifications complètes dans le contexte d'un LLM**.

**Objectifs :** contrat déclaratif versionné, validation automatique, index compact régénérable, historique accessible, création de tâches `ready` dès la validation documentaire, et archivage après livraison avérée.

**Hors périmètre :** modification de l'application `site/`, création d'issues obligatoires, base de données externe, mise à jour d'un fichier Markdown à chaque transition GitHub, et décision de priorisation par IA.

## 2. Source de vérité et arborescence cible

```text
backlog/
├── README.md                 # Guide humain, pas une base de données
├── index.json                # Projection générée des tâches actives
├── archive-index.json        # Projection générée de l'historique
├── tasks/
│   ├── TEMPLATE.md
│   └── TS-NNN.md              # Tâches en préparation / non archivées
└── archive/
    └── TS-NNN.md              # Tâches livrées avec preuves
```

- **Source de vérité déclarative :** frontmatter YAML de chaque tâche Markdown.
- **Source de vérité opérationnelle :** GitHub Actions, PR, commits et checks ; les champs Markdown ne prouvent pas une livraison.
- **Index :** fichiers JSON déterministes générés, non édités manuellement. La CI doit pouvoir les recalculer et refuser une divergence.
- **Traçabilité :** le déplacement en archive conserve le contenu Markdown et l'historique Git, avec référence à la livraison vérifiée. Les liens internes de la documentation affectée sont corrigés.
- **Progressivité :** les anciens chemins `backlog/tasks/TS-NNN.md` restent utilisables tant que les workflows actuels n'ont pas été adaptés. Aucune migration physique massive n'est nécessaire à la première PR du schéma.

## 3. Contrat du fichier de tâche

Exemple fictif :

```yaml
---
schema_version: 2
id: TS-012
type: product
status: ready
priority: high
automation: allowed
risk: low
depends_on:
  - TS-010
created_at: 2026-10-16
---

# TS-012 | Intitulé de la tâche

## Valeur utilisateur
...
## Périmètre
...
## Critères d'acceptation
...
## Contraintes et sécurité
...
## Hors périmètre
...
## Hypothèses et décisions
...
```

| Champ | Obligatoire V2 | Valeurs / sémantique |
| --- | --- | --- |
| `schema_version` | Oui | `2` |
| `id` | Oui | Unique et immuable ; `TS-NNN` pour ThreadStep |
| `type` | Oui | `product`, `factory` ; V1 orchestre seulement `product` |
| `status` | Oui | `proposed`, `ready`, `on_hold`, `canceled` ; état **déclaratif** |
| `priority` | Oui | `critical`, `high`, `normal`, `low` |
| `automation` | Oui | `allowed`, `manual` ; `allowed` par défaut à la génération |
| `risk` | Oui | `low`, `medium`, `high`, `unknown` ; jamais déduire `low` d'un manque d'information |
| `depends_on` | Oui | Liste d'IDs uniques ; `[]` si aucune dépendance |
| `created_at` | Oui pour nouvelles tâches | Date ISO `YYYY-MM-DD`, utilisée pour départage ; migration explicite des anciennes |

**Règle de génération :** le générateur renseigne `automation: allowed` par défaut, sauf demande contraire ou contre-indication identifiée. Il propose `status: ready` si les critères de préparation sont satisfaits, sinon `proposed` ; aucune étape de promotion supplémentaire n'est imposée à une tâche réellement prête. Pour un risque mal caractérisé, choisir `risk: unknown` et ne pas rendre la tâche exécutable automatiquement.

**Règle de sécurité V1 proposée :** `risk: low` seulement pour une vague produit automatique. `automation: allowed` exprime une éligibilité, **pas une autorisation de dépense**. `factory`, `medium`, `high` et `unknown` n'entrent pas dans la V1 ; une politique future dédiée sera nécessaire.

## 4. Cycle de vie

### 4.1 États déclaratifs

- `proposed` : description incomplète ou arbitrage bloquant.
- `ready` : critères de préparation vérifiés ; l'éligibilité d'exécution dépend encore des faits GitHub et des règles de vague.
- `on_hold` : suspension volontaire jusqu'à levée documentée.
- `canceled` : tâche annulée, jamais sélectionnée ; archivage éventuel séparé des livraisons.

Ne pas stocker `running`, `ci_pending`, `failed`, `merged` comme `status` déclaratif : ce sont des **observations opérationnelles**. L'archivage est une **localisation et une preuve documentaire**, pas une nouvelle valeur de préparation.

### 4.2 Critères pour `ready`

Valeur utilisateur/objectif, périmètre, comportements observables, critères d'acceptation vérifiables, hypothèses bloquantes résolues, risques et dépendances décrits, tests à prévoir, contraintes sécurité/accessibilité/mobile si pertinentes. Les dépendances peuvent être non livrées : elles bloquent l'exécution, **pas** la préparation.

### 4.3 Archivage après livraison

- L'archiveur reçoit une liste de tâches **dont la livraison a été indépendamment vérifiée** (PR finale fusionnée au SHA attendu, contrôles requis et autres preuves selon la politique).
- Il déplace uniquement ces fichiers vers `backlog/archive/`, conserve leur contenu historique, ajoute ou génère les métadonnées de livraison **sans cocher rétroactivement** les anciennes cases d'acceptation, puis régénère les index.
- Il ouvre une PR documentaire dédiée, en principe **une PR en fin de vague** pour toutes les tâches vérifiées, y compris lorsque la vague s'est arrêtée après un échec ultérieur.
- Cette PR doit être contrôlée par la CI indépendante de `main`. La fusion native n'est demandée que si une autorisation explicite la couvre et si la protection `Protect Main` et le check `check` sont vérifiés. Sinon, la PR demeure ouverte.
- Si l'archivage échoue, inscrire `archive_pending` dans le journal opérationnel ; le scheduler reconnaît la livraison par ses preuves GitHub et refuse toute réexécution.
- Les documents OpenSpec archivés sous `openspec/changes/archive/` conservent leur propre cycle de vie : il s'agit d'artefacts différents.

### 4.4 Hors vague

Des livraisons manuelles peuvent aussi nécessiter archivage. La V1 prévoit un processus de **réconciliation explicite et idempotent** qui retrouve les livraisons vérifiées sans dépendre d'une vague en cours.

## 5. Indexation et validation

`backlog/index.json` est un tableau stable de fiches compactes : `id`, `path`, `type`, `status`, `priority`, `automation`, `risk`, `depends_on`, `created_at`, `content_sha256`. Il n'intègre pas le texte des critères d'acceptation. `backlog/archive-index.json` liste les références archivées, leurs chemins et leurs preuves de livraison (numéro/URL de PR, SHA de fusion et de tête si disponibles, état de vérification), sans secrets.

Le générateur doit :

1. Parser strictement le YAML, rejeter les clés dupliquées, les valeurs inconnues et les champs obligatoires absents.
2. Contrôler unicité globale des IDs entre `tasks/` et `archive/`, noms de fichiers et identifiants cohérents.
3. Contrôler dépendances existantes, sans auto-référence, doublons ni cycles ; accepter des dépendances archivées si leur référence est valide.
4. Produire un ordre stable et des empreintes sur les **octets exacts** du fichier de tâche.
5. En mode `check`, échouer si index/version de schéma divergent des fichiers source.
6. Émettre des diagnostics compréhensibles, sans information sensible.

Le générateur ne doit pas conclure `delivered` à partir de la seule présence d'un fichier dans `archive/` ou d'un lien de PR dans l'index. La couche opérationnelle vérifie les faits GitHub.

## 6. Migration de ThreadStep

1. Ajouter le schéma et les validateurs, en gardant les chemins actuels.
2. Réconcilier les tâches historiques avec les PR réellement fusionnées et les contrôles documentés ; **ne pas** remplir implicitement `automation: allowed` sur les anciennes tâches.
3. Préserver les checklists d'origine et les historiques OpenSpec.
4. Traiter **TS-003** comme dette/évolution `factory`, non comme fonctionnalité produit éligible : préparer une tâche documentaire ASF distincte sans la lancer automatiquement.
5. N'activer les nouveaux chemins d'archive qu'après adaptation des consommateurs de `backlog/tasks/TS-NNN.md` et de la navigation documentaire.
6. Mettre à jour `backlog/tasks/TEMPLATE.md`, `backlog/README.md`, `AGENTS.md`, `ChatGPT.md`, `docs/factory/` et les tests dans une PR explicitement autorisée, conformément au contrat existant.

## 7. Critères d'acceptation

- [ ] Une tâche nouvelle, complète, peut être proposée `ready` avec `automation: allowed` par défaut ; une tâche incomplète reste `proposed`.
- [ ] Une tâche historique sans champ `automation` est exclue, jamais réputée `allowed`.
- [ ] Un index de 100 tâches est produit sans appel LLM et ne contient aucun corps Markdown.
- [ ] Dépendance inconnue, cyclique, identifiant dupliqué et index obsolète font échouer la validation.
- [ ] L'état `ready` ne suffit jamais à autoriser un appel OpenRouter.
- [ ] Une livraison vérifiée peut être archivée par PR documentaire ; une tâche non livrée ne le peut pas.
- [ ] Un archivage en attente n'expose pas la tâche à une nouvelle exécution.
- [ ] Les liens, critères historiques, spécifications canoniques et règles de protection de `main` sont préservés.

## 8. Sécurité et limites

Backlog en dépôt public : pas de secrets, clés, données personnelles ni informations de coût fournisseur sensibles. Les opérations de fusion, de modification des workflows et des secrets nécessitent des autorisations distinctes. Les contrôles de schéma et d'index ne sont pas des preuves de sécurité de code.