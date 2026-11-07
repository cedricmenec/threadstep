# ASF-V3-017 — Capture réelle du run propriétaire (lecture seule)

Statut : **proposition de PR brouillon, pas sur main**, et non autorisant. Date : 17 octobre 2026.

## Mandat propriétaire effectivement communiqué

- **Exécuteur V1** : [GitHub App threadstep-software-factory](https://github.com/apps/threadstep-software-factory), App ID **5321746**.
- **Contrôleur V3** : App GitHub `ASF Controller V3`, App ID **5361227** (distincte de l'exécuteur).
- Propriétaire des deux Apps : `cedricmenec`, installation limitée à `cedricmenec/threadstep`.
- Le contrôle de sécurité de `github-native-control.mjs` épingle désormais **5361227** ; il ne suffit pas qu'une quelconque `Integration` ait un bypass.

## Ce que l'owner n'a PAS à programmer à la main

Le workflow V3 `.github/workflows/backlog-orchestrator-v3.yml` expose **déjà** six inputs dans le menu Actions. Ce lot lui ajoute **uniquement une étape de préflight en lecture seule**. Les permissions restent :

```yaml
permissions:
  contents: read
  actions: read
```

La séquence reste volontairement :

1. Workflow GitHub sur `refs/heads/main`, auteur `cedricmenec`, `run_attempt=1`.
2. Checkout du SHA exact du run owner sans conserver le jeton.
3. `npm run backlog:check` vérifie le backlog et le contenu des tâches réellement présents dans ce commit.
4. `node scripts/asf/v3/owner-run-capture.mjs verify` lit les six inputs depuis **`GITHUB_EVENT_PATH`**, pas depuis un argument CLI ou une PR enfant ; recalcule les candidats/hashes depuis `backlog/index.json` et compare leur hash à l'input propriétaire.
5. Lit indépendamment le run owner via `GITHUB_TOKEN` **read-only** et compare acteur, SHA, run ID, événement, attempt, chemin workflow et branche. Lit le ruleset main et les **deux** rulesets globaux, avec bypass App ID **5361227**.
6. N'émet qu'une observation `owner_intent_observed_no_write`, avec `authorized:false`, `canCreate:false`, `canWrite:false`, `canDispatch:false`, `canSpend:false`.
7. Le workflow **exécute toujours l'étape finale de refus** via `workflow-runtime-preflight.mjs controller`. Il n'a donc aucun chemin vers un token d'écriture, bootstrap, dispatch ou OpenRouter.

**Les six inputs sont le mandat propriétaire à saisir lors d'un futur `workflow_dispatch` sur main.** GitHub REST GET du run n'expose pas les inputs : d'où la lecture directe de l'event GitHub par le runner, puis la comparaison avec le run REST et le manifeste V3 généré par le module.

## Politique explicite de candidats du prototype V3

Le préflight détermine l'ordre **lexicographique des ID** parmi les tâches ayant simultanément :

- `type: product` ;
- `status: ready` ;
- `automation: allowed` ;
- `risk: low` ;
- `depends_on: []` (pas de dépendances non satisfaites à résoudre implicitement).

Chaque `{ id, sha256 }` provient de l'index Backlog V2 vérifié contre les fichiers Markdown. Le hash `candidate_set_sha256` est le SHA-256 de sa sérialisation JSON canonique (fonction `contentSha256`). **Ce choix de sélection est une politique initiale auditable, pas encore un choix produit approuvé.** Les IDs et leur hash doivent être présentés par le CLI `preview` à l'owner **sur le SHA de main qu'il approuvera**, avant tout démarrage. Aucun hash arbitraire fourni par l'agent n'est accepté.

Prévisualisation **sans API, secret, dispatch ou paiement**, dans un checkout vérifié de `main` **une fois les PR approuvées et fusionnées** :

```bash
git checkout main
git pull --ff-only
git rev-parse HEAD
node scripts/asf/v3/owner-run-capture.mjs preview
```

La commande affiche les `selected` et le `candidate_set_sha256`. Le choix précis des tâches peut évoluer dans une PR dédiée, sans jamais laisser l'agent sélectionner librement son propre hash de mandat.

## Règles GitHub : problème P0 détecté le 17/10/2026

Les deux rulesets réels existent mais **ne ciblent pas la référence V3** à la date de vérification :

- [Writer 25316890](https://github.com/cedricmenec/threadstep/rules/25316890) : `refs/heads/refs/heads/asf/control/active-wave-v3` (préfixe dupliqué).
- [Immutable 25316926](https://github.com/cedricmenec/threadstep/rules/25316926) : `refs/heads/refs/heads/asf/control/active-wave-v3,` (préfixe dupliqué + virgule finale).

La règle writer doit cumuler **`creation` (`Restrict creations`) et `update` (`Restrict updates`)**, avec un bypass unique de l'App `5361227`. **Le seul `update` ne suffit pas à empêcher l'App V1 de créer la branche avant le bootstrap**, selon les règles GitHub. La règle d'intégrité reste `deletion` + `non_fast_forward` sans bypass.

La cible attendue dans le JSON des deux rulesets est **exactement** `refs/heads/asf/control/active-wave-v3`, sans virgule. Dans l'interface `Include by pattern`, saisir **`asf/control/active-wave-v3`** si GitHub ajoute automatiquement le préfixe ; vérifier les JSON GET après Save. Ne pas créer la référence globale avant cette correction.

## Reste à faire avec décision indépendante

- Corriger réellement les deux rulesets (cibles et `creation` + `update` côté writer) ; faire des tests de permissions **sans écriture sur le ref opérationnel**.
- Configurer l'environnement protégé `asf-v3-controller` sur `main` et la variable d'environnement `ASF_V3_CONTROLLER_APP_ID=5361227` ; garder la clé PEM hors des secrets GitHub tant que le job privilégié n'a pas été revu.
- Implanter la connexion environnement + jeton App contrôleur restreint **dans une PR séparée** après revue, sans V1 ni agent enfant.
- Concevoir bootstrap unique avec CAS/erreurs 403/409/422/quarantaine (AUCUNE reprise d'écriture automatique), puis writer terminal release/quarantine ; intégration dispatcheur/child ACK/CLAIM_CHILD/mutex V1/V3 ; tests E2E GitHub non payants.
- **Aucune fusion, activation privilégiée ni appel payé n'est autorisé par cette PR.**

Procédure utilisateur mise à jour : [Notion ASF V3 — App contrôleur et actions immédiates](https://app.notion.com/p/3fc12ac9163681eb8dacca65bdbfc882).

### Qualifications

La CI doit exécuter `npm run check` et actionlint. Les nouvelles simulations couvrent la manipulation des six inputs, le changement de rôle App, le faux run owner, une branche différente, les règles mal ciblées, un mauvais hash de candidats, l'API indisponible et le journal event injecté. **Tests réussis ≠ permissions GitHub App prouvées.**
