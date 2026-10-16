# Migration historique du backlog V2 (ASF-V2-003)

**Statut : implémenté dans la PR d'ASF-V2-003, non encore fusionné ni vérifié
sur `main`.** Ce document décrit la migration réellement effectuée par
[ASF-V2-003](tasks/ASF-V2-003.md) pour la référence normative
[Backlog V2](specs/backlog-v2.md) (sections 2, 5 et 6). Il complète
[l'index déterministe](backlog-v2-index.md) (ASF-V2-002) et le
[contrat des tâches V2](backlog-v2-task-contract.md).

## 1. Objet et limites

- Ajouter le frontmatter V2 **sans modifier le corps** des tâches historiques
  `backlog/tasks/TS-NNN.md` : les critères, cases non cochées, sections
  OpenSpec et preuves de livraison restent intacts.
- Conserver les chemins `backlog/tasks/TS-NNN.md` utilisés par les workflows
  manuels actuels (`agent.yml`, `agent-openspec.yml`). **Aucun archivage
  physique** n'est réalisé ici : il appartient à [ASF-V2-010](tasks/ASF-V2-010.md).
- Ne jamais déduire `automation: allowed`. Toutes les tâches migrées sont
  `automation: manual` et `risk: unknown`, donc jamais auto-exécutables.
- Aucune modification de `site/`, des workflows, des secrets ou des
  permissions ; aucun appel OpenRouter.

## 2. Inventaire et incertitudes

Les preuves ci-dessous sont **transcrites** des documents existants
(`docs/factory/current-state.md`, fiches TS, PR GitHub). Elles n'ont pas été
re-vérifiées indépendamment par cette tâche, qui n'appelle aucune API GitHub.

| Tâche | Objet | Preuve déclarée | Incertitude |
| --- | --- | --- | --- |
| TS-001 | MVP statique | CI et Pages vérifiées après PR #26 | Pas de PR d'implémentation unique : livré avant la trace, maintenu ensuite |
| TS-002 | Smoke test agent OpenCode | [PR #2](https://github.com/cedricmenec/threadstep/pull/2) fusionnée | Preuve documentaire uniquement |
| TS-003 | Vagues autonomes | **Jamais implémentée** (backlog) | Classée dette factory, hors éligibilité produit |
| TS-004 | Réordonner les sujets | [PR #4](https://github.com/cedricmenec/threadstep/pull/4) fusionnée | Preuve documentaire uniquement |
| TS-005 | Modifier une action/sous-étape | [PR #8](https://github.com/cedricmenec/threadstep/pull/8), OpenSpec archivé | Preuve documentaire uniquement |
| TS-006 | Masquer les étapes terminées | [PR #12](https://github.com/cedricmenec/threadstep/pull/12) fusionnée | Preuve documentaire uniquement |
| TS-007 | Suggestion déterministe | [PR #18](https://github.com/cedricmenec/threadstep/pull/18), OpenSpec archivé | Preuve documentaire uniquement |
| TS-008 | « Je reprends ici » | [PR #21](https://github.com/cedricmenec/threadstep/pull/21), capacité ADDED | Preuve documentaire uniquement |
| TS-009 | Expliquer la suggestion | [PR #26](https://github.com/cedricmenec/threadstep/pull/26), MODIFIED OPSX | Preuve documentaire uniquement |
| TS-010 | Annuler le retrait (snackbar) | [PR #32](https://github.com/cedricmenec/threadstep/pull/32), capacité action-removal | Preuve documentaire uniquement |
| TS-011 | Réordonner par glisser-déposer | [PR #34](https://github.com/cedricmenec/threadstep/pull/34), capacité action-ordering | Preuve documentaire uniquement |

**Incertitudes explicites conservées :**

- La date de création d'origine n'est pas connue : `created_at` utilise la
  date d'ajout Git (`git log --diff-filter=A`) comme **proxy reproductible**,
  soit `2026-10-14` (TS-001 à TS-007) et `2026-10-15` (TS-008 à TS-011).
  Aucune date n'est inventée ; la limite est assumée.
- TS-001 n'a pas de PR unique et TS-003 n'a jamais été livrée. Leur statut
  déclaratif reflète cette réalité, pas une livraison.
- Les preuves de livraison restent dans les sections « Delivery status
  verification » des fiches et dans `docs/factory/current-state.md`. La
  présence d'un lien de PR ne vaut pas vérification GitHub.

## 3. Frontmatter appliqué

Chaque fichier migré commence par un bloc YAML fermé `---`, dans l'ordre
canonique du contrat :

```yaml
---
schema_version: 2
id: TS-NNN
type: product        # factory pour TS-003
status: on_hold
priority: normal     # high pour TS-008
automation: manual
risk: unknown
depends_on: []       # dépendances transcrites du corps
created_at: 2026-10-14  # date d'ajout Git
---
```

Décisions de migration, alignées sur la spécification :

- **`automation: manual`** pour toutes les tâches historiques. Aucune ne
  revendique `allowed`, conformément à la règle « ne pas remplir implicitement
  `automation: allowed` sur les anciennes tâches ». Une tâche `manual` n'est
  jamais sélectionnée par le scheduler V1.
- **`risk: unknown`** par défaut : le risque n'a pas été caractérisé
  historiquement et `unknown` ne vaut jamais `low`. Les tâches restent donc
  inéligibles même si un autre champ changeait.
- **`status: on_hold`** : les tâches livrées sont gelées en attendant leur
  archivage documentaire (ASF-V2-010) ; TS-003 est suspendue en attendant une
  fiche factory dédiée. Aucune observation opérationnelle (`merged`,
  `delivered`) n'est stockée comme `status` déclaratif.
- **`priority`** : transcrite quand la fiche la déclare (TS-008 → `high`) ;
  sinon `normal`, valeur neutre, sans inventer de criticité.
- **`depends_on`** : extrait des lignes « Dependencies » des fiches
  (TS-004/005/006/007 → TS-001 ; TS-008/009 → TS-007 ; TS-010 → TS-005,
  TS-008 ; TS-011 → TS-001, TS-004, TS-007, TS-005).
- **`type`** : `product` sauf **TS-003 → `factory`**.

## 4. TS-003 : dette factory

`TS-003` décrivait déjà « separate reusable factory from application » ; ce
n'est pas une fonctionnalité produit. Elle est donc :
`type: factory`, `automation: manual`, `status: on_hold`. Elle sort de
l'éligibilité produit et devra être reprise par une tâche `ASF-*` dédiée,
sans exécution automatique. Sa fiche et ses critères d'origine restent
inchangés.

## 5. Index et README

- `backlog/index.json` est régénéré par `npm run backlog:index` : 11 fiches
  actives, triées par ID, chaque `content_sha256` couvrant les octets exacts
  du fichier migré. `backlog/archive-index.json` reste `[]` (aucun archivage
  physique).
- `backlog/README.md` est simplifié : il ne duplique plus l'état par tâche
  (porté par l'index généré) et renvoie à ce document, au contrat V2 et à
  `docs/factory/current-state.md` pour les preuves opérationnelles.

## 6. Compatibilité des workflows

Les chemins `backlog/tasks/TS-NNN.md` sont conservés et le corps Markdown est
strictement préservé. `agent.yml` et `agent-openspec.yml` continuent de
`test -f` puis `cat` le fichier de tâche sans parseur de frontmatter. Le corps
reste le contrat de travail relu par les agents.

## 7. Vérification et limites

- Invariants contrôlés par `tests/backlog-v2-migration.test.mjs` : frontmatter
  V2 complet, enums valides, `automation: manual` partout, `type: factory`
  pour TS-003, dates issues du proxy Git documenté, critères/cases historiques
  présents et inchangés, index cohérent avec les fichiers.
- `npm run check` exécute les tests, puis `backlog:check` (désormais 11 actifs,
  0 archivé) puis `node --check` sur `site/core.js` et `site/app.js`.
- **Non vérifié** : CI GitHub indépendante sur le SHA de la PR, fusion,
  archivage réel (ASF-V2-010) et comportement du futur scheduler. Aucun appel
  OpenRouter payant n'a été effectué pour cette tâche.
