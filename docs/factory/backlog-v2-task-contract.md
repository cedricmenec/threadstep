# Contrat des tâches Backlog V2 (ASF-V2-001)

**Statut : documentaire, défini et couvert par des tests statiques.**
Référence normative : [spécification Backlog V2](specs/backlog-v2.md) (version 0.1,
approuvée pour découpage). Ce document décrit le contrat effectivement appliqué
à `backlog/tasks/TEMPLATE.md`, `AGENTS.md` et `ChatGPT.md` par ASF-V2-001. Le
validateur strict et la régénération des index sont implémentés par
[ASF-V2-002](tasks/ASF-V2-002.md) (voir
[index déterministe](backlog-v2-index.md)) ; la migration historique est
implémentée en revue par [ASF-V2-003](tasks/ASF-V2-003.md) (voir
[migration historique](backlog-v2-migration.md)). Aucune migration physique
d'archive et aucune exécution automatique ne sont livrées.

## 1. Portée

- Définir le frontmatter versionné des tâches et les règles de génération.
- Ne rien migrer, ne pas générer d'index, ne pas modifier de workflow.
- Ne pas retirer les chemins `backlog/tasks/TS-NNN.md` existants.

## 2. Deux sources de vérité distinctes

- **État déclaratif** : le frontmatter YAML du fichier `backlog/tasks/TS-NNN.md`.
  Il décrit la préparation, la priorité, l'éligibilité et les dépendances.
- **État opérationnel** : PR, commits, checks et runs GitHub. Un champ Markdown,
  une case cochée ou un fichier présent ne prouvent **jamais** une livraison.
- Les observations opérationnelles (`running`, `ci_pending`, `failed`, `merged`)
  ne sont pas des valeurs de `status` déclaratif.

## 3. Champs obligatoires et enums

| Champ | Obligatoire V2 | Valeurs / sémantique |
| --- | --- | --- |
| `schema_version` | Oui | `2` |
| `id` | Oui | Unique et immuable ; `TS-NNN` pour ThreadStep |
| `type` | Oui | `product`, `factory` ; la V1 n'orchestre que `product` |
| `status` | Oui | `proposed`, `ready`, `on_hold`, `canceled` (état déclaratif) |
| `priority` | Oui | `critical`, `high`, `normal`, `low` |
| `automation` | Oui | `allowed`, `manual` ; `allowed` par défaut à la génération |
| `risk` | Oui | `low`, `medium`, `high`, `unknown` ; jamais déduire `low` d'un manque d'information |
| `depends_on` | Oui | Liste d'IDs uniques ; `[]` si aucune dépendance |
| `created_at` | Oui pour les nouvelles tâches | Date ISO `YYYY-MM-DD`, utilisée pour départager ; migration explicite des anciennes |

## 4. Règles de génération

- **`automation: allowed` par défaut**, sauf demande contraire ou contre-indication
  identifiée. `allowed` exprime une **éligibilité déclarative**, jamais une
  autorisation de dépense, de fusion ou de modification de code, de secret ou de
  permission.
- **`status: ready`** si les critères de préparation sont satisfaits
  (valeur utilisateur, périmètre, comportements observables, critères vérifiables,
  hypothèses bloquantes résolues, risques et dépendances décrits, tests prévus,
  contraintes de sécurité/accessibilité/mobile si pertinentes), sinon
  **`proposed`**. Une tâche réellement prête peut l'être dès sa PR documentaire,
  **sans seconde promotion**.
- **`risk: unknown`** dès que le risque n'est pas caractérisé. `unknown` ne vaut
  **jamais** `low` et n'est **jamais** automatiquement exécutable.
- **Les contre-indications explicites priment sur le défaut** : `type: factory`,
  `risk: medium`, `risk: high`, `risk: unknown`, ou une tâche historique dépourvue
  de champ `automation` ne sont pas éligibles à une exécution automatique, même
  si `automation: allowed` a été recopié.

## 5. Isolation des règles ThreadStep

- L'identifiant `TS-NNN` et ses règles produit sont **propres à ThreadStep** et ne
  constituent pas une convention générique de la factory.
- Les tâches de factory portent un identifiant `ASF-*` sous `docs/factory/tasks/`
  et **doivent** déclarer `Automation: manual` (format contrôlé par
  `scripts/agent-asf-policy.mjs`). Elles ne sont jamais auto-exécutables.
- Créer, planifier ou marquer `ready` une tâche n'autorise **ni** appel payant,
  **ni** fusion, **ni** modification de workflow, de secret ou de permission.

## 6. Vérification

Les invariants ci-dessus sont contrôlés statiquement par
`tests/backlog-v2-contract.test.mjs` dans `npm run check` :

- présence de tous les champs V2 dans `backlog/tasks/TEMPLATE.md` ;
- valeurs par défaut de génération du modèle (`status: proposed`,
  `automation: allowed`, `risk: unknown`, `depends_on: []`) ;
- enums documentés (`product`/`factory`, `proposed`/`ready`/`on_hold`/`canceled`,
  `critical`/`high`/`normal`/`low`, `allowed`/`manual`, `low`/`medium`/`high`/`unknown`) ;
- directives présentes dans `AGENTS.md` et `ChatGPT.md` ;
- tâches factory `ASF-V2-NNN` déclarées `Automation: manual` ;
- aucune tâche historique `backlog/tasks/TS-NNN.md` ne revendique
  `automation: allowed`.

ASF-V2-002 ajoute une validation **exécutable** du même contrat :
`tests/asf-backlog-index.test.mjs` contrôle le parseur strict (clé dupliquée,
enums, types), l'unicité des IDs, les dépendances inconnues, les cycles et
l'obsolescence d'index, et `npm run check` exécute
`node scripts/asf/backlog-cli.mjs check` **sans écriture**. Détails et limites
dans [index déterministe](backlog-v2-index.md).
