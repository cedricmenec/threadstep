# Architecture

> La documentation de référence de la **software factory générique** est désormais dans [docs/factory/README.md](factory/README.md). Cette page décrit principalement le **pilote ThreadStep**.

## Application
- Static `site/index.html` + CSS and vanilla ECMAScript modules; no runtime application server. The delivered UI remains vanilla: TS-058 installs pinned React dependencies and proves a dormant integration boundary, but `site/app.js` never imports or mounts a React business surface before TS-059.
- Vite (`TS-057`) uses `site/` as the source and writes an unversioned `dist/` artifact with base `/threadstep/`; the protected Pages pipeline (`ASF-WF-004`) builds and publishes this artifact while preserving the vanilla application.
- `site/core.js` contains pure domain functions and schema validation, testable with built-in Node test runner.
- `site/app.js` owns browser DOM/localStorage, import/export, rendering and events.
- `site/react-boundary.js` records exclusive ownership of one bounded container and blocks vanilla replacement while a React root is active; `site/react-adapter.js` exposes a frozen read-only snapshot, separate transient state, named controller commands and explicit invalidation without importing Dexie or OTP. The production build contains no React runtime until a real surface imports it.
- Network access stays limited to the configured Dexie Cloud hosts by the production CSP.
- Public Pages serves the compiled assets from `dist/`, never `docs/` or repository metadata. The preserved `site/` sources remain the tested rollback path through an authorized and CI-checked PR. No browser data is migrated by this deployment.

## Factory pilot
1. Human + ChatGPT coauthor product intent and backlog under version control.
2. `CI` validates every PR independently (Node tests, Actionlint, embedded Bash syntax, strict OpenSpec).
3. `Pages` runs after changes reach `main`, executes a clean, verified Vite build and deploys only `dist/`.
4. Two owner-dispatched **manual agent** workflows exist: `Agent (manual, OpenRouter)` (direct, `TS-NNN`) and `Agent OpenSpec (manual, staged or auto)` (plan/apply/auto/finalize, accepts `11` or `TS-011`). Both execute OpenCode on a dedicated branch and open a PR through the GitHub App; no paid run starts on pushes or PRs.
5. An additional owner-dispatched **Backlog Orchestrator V1** authorizes 1 or 2 sequential OpenSpec product-task starts (`mode=dry-run|execute`), with a frozen manifest, a durable journal and independent post-merge CI/Pages verification before the next paid task. [Developer guide](factory/developer-guide.md). No paid model runs automatically on public PRs, issues or pushes. For final agent PRs, the owner may disable `auto_merge`; if enabled, GitHub merges only after required `check` CI. Auto-merge is demonstrated on TS-010 (#32) and TS-011 (#34), followed by Pages.

## Security and budget
- API key exists only in GitHub Actions repository secrets, never in frontend assets.
- Agent executes only via explicitly authorized GitHub Actions dispatch and owner-only guard.
- Workflow jobs have narrow permissions and a 20-minute timeout.
- No untrusted pull request receives OpenRouter secrets.
- An independent `check` CI and the active `Protect Main` branch ruleset gate merge. GitHub native auto-merge is tested for OpenSpec; the owner still authorizes paid workflow starts. The bounded V1 wave orchestrator is delivered; expanding to 10 tasks remains future work.
- Run-level budgets depend on OpenRouter account limits and the selected model; GitHub timeout alone is not a hard spend cap.

## Future generic factory
Extract reusable workflows and policies into their own versioned repository or reusable GitHub workflows after validating one real delivery. Keep business logic separate from factory orchestration.

## Matrice de régression TS-045 (liaison Cloud et reprise)

Cette matrice documente les scénarios déterministes couverts par les tests et
les vérifications qui restent une **recette humaine** sur une instance Dexie
Cloud isolée. Une CI verte ne prouve ni une session OTP réelle, ni une
convergence métier entre appareils.

| Scénario | Attendu | Preuve |
| --- | --- | --- |
| Profil neuf | Cache vide lié au compte courant, aucun cache de récupération | tests unitaires de liaison |
| Profil historique | Cache peuplé sans attestation reste masqué, récupération isolée explicite | tests de classification et de récupération |
| Android et laptop | Même compte et même URL relisent la même base locale, sans copie | recette réelle sur deux appareils |
| Local vers Cloud | Activation explicite, source autonome intacte | tests d'activation existants |
| Cloud vers local | Aucun transfert implicite, cache Cloud conservé | tests de transition |
| A/B/A | Chaque espace retrouve sa base et sa liaison, aucune fusion | tests d'identité d'espace |
| Compte ou URL différents | Données métier masquées, aucune copie ni purge | tests de liaison |
| Rechargement | Liaison attestée relue avant toute lecture métier | tests de bootstrap |
| Onglets concurrents | Fusion relue, aucun écrasement d'une empreinte attestée | tests de fusion de registre |
| Hors ligne | Liaison locale attestée lisible, preuve distante indéterminée | tests de diagnostic |
| Mutations en attente | Conservées, avertissement et confirmation explicites | tests existants de purge/déconnexion |
| Session expirée | Même base après reconnexion, données masquées sans session valide | tests de liaison |

### Règles d'investigation et d'expurgation

- Trace expurgée : la trace de bootstrap ne contient que des codes d'étape, catégories,
  compteurs, booléens et horodatages relatifs, avec un nombre d'événements
  borné ; une trace absente ou illisible ne bloque pas le démarrage.
- Ne jamais journaliser email, OTP, jeton, identifiant utilisateur brut, URL
  brute, titre, note ou message d'erreur brut.
- Une cause non reproduite reste `indéterminée` : le cache reste masqué et
  récupérable, aucune cause racine n'est inventée.
- Un état natif `in-sync`, un pull attesté ou une lecture locale ne constitue
  pas une preuve de convergence métier ni une présence sur un autre appareil.
