# Index déterministe et validation stricte du backlog (ASF-V2-002)

**Statut : implémenté dans la PR d'ASF-V2-002, non encore fusionné ni vérifié
sur `main`.** Ce document décrit le comportement réellement codé par
[ASF-V2-002](tasks/ASF-V2-002.md) pour la référence normative
[Backlog V2](specs/backlog-v2.md) (section 5). La migration des tâches
historiques reste portée par [ASF-V2-003](tasks/ASF-V2-003.md) et l'archiveur
par [ASF-V2-010](tasks/ASF-V2-010.md).

## 1. Objet et limites

- Produire `backlog/index.json` et `backlog/archive-index.json` à partir des
  **seuls fichiers Markdown**, sans LLM, sans réseau et sans dépendance tierce.
- Rejeter un backlog mal formé avec un diagnostic localisable (chemin + motif).
- Ne jamais déduire une livraison de la présence d'un fichier dans
  `backlog/archive/`.
- Hors périmètre : déplacement de fichiers, création de PR, appel payant,
  sélection de tâche ou modification de workflow.

## 2. Commandes

```text
npm run backlog:index    # node scripts/asf/backlog-cli.mjs generate
npm run backlog:check    # node scripts/asf/backlog-cli.mjs check
```

`generate` valide puis écrit les deux index ; en cas de diagnostic il **n'écrit
rien** et sort en erreur. `check` recalcule la projection en mémoire et échoue
si un index est absent ou divergent ; **il n'écrit jamais**. `check` est intégré
à `npm run check` (`npm test && npm run backlog:check && node --check ...`).

Les deux commandes acceptent `--root <dossier>` (utilisé par les tests sur des
répertoires temporaires). Le reste du projet n'utilise que la racine du dépôt.

## 3. Format des index

`backlog/index.json` est un **tableau** trié par identifiant (comparaison
déterministe des unités de code, jamais sensible à la locale). Chaque fiche
compacte reprend les champs du frontmatter sans le corps Markdown :

| Champ | Origine |
| --- | --- |
| `id`, `type`, `status`, `priority`, `automation`, `risk`, `depends_on`, `created_at` | frontmatter validé |
| `path` | chemin dépôt en POSIX, ex. `backlog/tasks/TS-012.md` |
| `content_sha256` | SHA-256 des **octets exacts** du fichier de tâche |

`backlog/archive-index.json` a la même forme, plus un champ `delivery`
explicitement **nullable** :

- `delivery: null` quand aucune preuve n'est déclarée : la présence en archive
  ne prouve donc jamais `delivered` ;
- `delivery: { pull_request, pull_request_url, merge_sha, head_sha, verified }`
  uniquement lorsque le frontmatter archivé déclare ces champs. Cette forme est
  l'interface initiale destinée à [ASF-V2-010](tasks/ASF-V2-010.md) ; elle ne
  constitue pas une vérification GitHub.

La sérialisation est `JSON.stringify(entries, null, 2)` suivie d'un saut de
ligne final. À contenu de fichiers égal, les octets produits sont identiques :
aucune horloge, aucun ordre de lecture du système de fichiers ni aucune donnée
d'environnement n'entre dans la sortie.

## 4. Validation stricte

Le lecteur de frontmatter (`scripts/asf/yaml.mjs`) ne prend en charge que le
sous-ensemble utile et **rejette** : bloc `---` non fermé, tabulations, clés
dupliquées, clés invalides, scalaires non terminés et constructions YAML non
supportées (ancres, flux, scalaires multi-lignes). Les commentaires en fin de
ligne ne sont pas interprétés ; seules les lignes de commentaire entières le
sont.

Le validateur (`scripts/asf/backlog-index.mjs`) contrôle ensuite :

1. champs obligatoires présents et de type attendu (`scalar` ou liste) ;
2. `schema_version: 2` ;
3. enums `type`/`status`/`priority`/`automation`/`risk` ;
4. `id` sûr (`^[A-Z][A-Z0-9]*-[0-9]{1,4}$`) et `created_at` ISO réel ;
5. `depends_on` : liste d'IDs sûrs, sans doublon ni auto-référence ;
6. unicité globale des IDs entre `backlog/tasks/` et `backlog/archive/` ;
7. cohérence entre le nom de fichier et l'`id` ;
8. dépendances connues, sans cycle ;
9. absence de champ inconnu (typo), de lien symbolique et de chemin non sûr ;
10. en archive, champs `delivery` autorisés et bien typés uniquement.

Les fichiers sans frontmatter V2 (tâches historiques `TS-NNN` actuelles) sont
**exclus** et listés à part : ils ne sont ni indexés ni considérés en erreur
tant que [ASF-V2-003](tasks/ASF-V2-003.md) ne les a pas migrés. Une dépendance
vers un ID non migré est en revanche inconnue et échoue la validation.

## 5. État actuel et preuves

- Les onze tâches historiques `TS-001` à `TS-011` portent désormais le
  frontmatter V2 depuis la migration [ASF-V2-003](tasks/ASF-V2-003.md) ; les
  index sont donc peuplés (11 fiches actives, 0 archivée) et `npm run check`
  réussit. Voir [migration historique](backlog-v2-migration.md).
- Tests déterministes : `tests/asf-backlog-index.test.mjs` couvre 100 tâches
  fictives (index byte-identique, corps absent), clé dupliquée, cycle, ID
  double, dépendance inconnue, auto-référence, enums invalides, index obsolète
  et `check` sans écriture, ainsi que la dépendance vers une archive valide
  dont `delivery` reste `null`.
- Exécuté localement par la PR ASF-V2-002 : `npm run check` →
  `npm test` **130 tests réussis**, puis `backlog:check` (0 actif, 0 archivé),
  puis `node --check site/core.js` et `node --check site/app.js`. Aucun
  workflow n'est modifié, donc Actionlint n'est pas requis.
- **Non vérifié** : CI GitHub indépendante sur le SHA de la PR, fusion, et
  comportement après migration ASF-V2-003. La CI reste l'autorité.

## 6. Garanties et non-garanties

- Garanti par construction : déterminisme de la sortie, refus d'écrire un index
  invalidé, absence de corps Markdown dans les index, `check` sans écriture.
- **Non garanti** : que la présence d'une preuve `delivery` corresponde à un
  fait GitHub réel. Cette vérification appartient aux couches opérationnelles
  (ASF-V2-007/010) ; les index restent une projection déclarative.
