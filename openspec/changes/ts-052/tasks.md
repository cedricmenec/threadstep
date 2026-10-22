# Tasks

## Implementation checklist (apply, before OPSX sync)

### 1. Pure overview read-presentation model

- [ ] 1.1 Add `site/overview-read-state.js` with exported presentation states (`initializing`, `awaiting-read`, `available`, `action-required`), the deterministic `OVERVIEW_LOADER_DELAY_MS = 250` and `OVERVIEW_DURABLE_WAIT_MS = 8000` constants, and a pure `buildOverviewReadPresentation(input)` that uses only injected signals and injected elapsed time; add `tests/ts-052-overview-read-state.test.mjs` covering a healthy `loading` → `connecting` → `initial` → `in-sync` sequence with no attention, `in-sync` without a completed read, an authorized pending read, available projects, confirmed read/storage errors, expired or refused sessions, binding `unverified`/`mismatch`/destination mismatch, indeterminate binding, local workspace and durable wait; run `node --test tests/ts-052-overview-read-state.test.mjs`.
- [ ] 1.2 Extend the same test file to prove state precedence and stability: confirmed errors are reported immediately even before any delay, available projects remain `available` across transient phase changes, `in-sync` alone never yields `available`, the same inputs produce the same state and announcement key, the loader stays hidden before the delay and disappears on resolution, and durable wait appears only after its threshold; run `node --test tests/ts-052-overview-read-state.test.mjs`.
- [ ] 1.3 Add static assertions that `site/overview-read-state.js` uses no DOM, `localStorage`, IndexedDB, `fetch`, native Dexie subscription, timer scheduling or business mutation, and that its output exposes no email, OTP, token, raw error message or business content; run `node --test tests/ts-052-overview-read-state.test.mjs`.

### 2. Stable overview rendering and presentation adapter

- [ ] 2.1 Add a hidden `#projects-loading` region inside `#dashboard` immediately before `#subjects`, with `role="status"`, `aria-live="polite"`, `aria-busy="true"` when active and the text « Chargement de vos projets… », plus `site/styles.css` rules for compact stable dimensions, no horizontal overflow, hidden state and `prefers-reduced-motion`; add deterministic markup and CSS assertions in `tests/ts-052-overview-presentation.test.mjs`; run `node --test tests/ts-052-overview-presentation.test.mjs`.
- [ ] 2.2 Add the single presentation adapter in `site/app.js` with a generation token, pending-since timestamp, one cancellable timer and guarded callbacks; make it cancel and clean up on read resolution, confirmed error, route change, workspace or binding change and reload; test the sliced adapter with injected clock and timer functions in `tests/ts-052-overview-presentation.test.mjs`, including a late callback after a route or account change; run `node --test tests/ts-052-overview-presentation.test.mjs`.
- [ ] 2.3 Wire the adapter into `applyBusinessVisibility()`, `render()` and `applySyncSummaryVisibility()` so `awaiting-read` shows the loader and suppresses the list, counter, suggestion/resume cards and add form; `available` shows the existing list through `replaceSubjectsInCurrentView()`; `initializing` remains silent; and `action-required` shows the persistent summary and link without replacing an already available list; verify with deterministic model/source assertions in `tests/ts-052-overview-presentation.test.mjs`.
- [ ] 2.4 Replace the overview alert decision with the new presentation result while keeping `buildDiagnosticSummary()` for `#sync-diagnostic`; pass the new action flag to `overviewAccessLinkVisible()` and prove with tests that ordinary `loading`, `connecting`, `initial`, `pulling`, `pushing`, `not-in-sync` and pending pull states show neither summary nor link, while confirmed errors, expired/refused sessions, binding blocks and durable waits show both; run `node --test tests/ts-052-overview-presentation.test.mjs`.
- [ ] 2.5 Deduplicate accessible updates by stable state/text key so repeated renders do not rewrite unchanged status content or toggle `aria-busy` unnecessarily; assert with deterministic render simulations that the loader is not focusable, does not move focus or scroll, and that a repeated identical state produces no additional announcement; run `node --test tests/ts-052-overview-presentation.test.mjs`.
- [ ] 2.6 Update the existing tests that still assert the old overview alert behavior for connecting, initial or pending pull states, especially `tests/ts-043-sync-page.test.mjs`, `tests/ts-044-settings-hub.test.mjs` and `tests/ts-047-trust-guidance.test.mjs`, without weakening their assertions on the detailed diagnostic, its text, retry guards, controls and non-interactive summary; run `node --test tests/ts-043-sync-page.test.mjs tests/ts-044-settings-hub.test.mjs tests/ts-047-trust-guidance.test.mjs tests/ts-052-overview-presentation.test.mjs`.

### 3. Isolation, security and absence of side effects

- [ ] 3.1 Add deterministic tests for an A→B account or workspace switch, late native events from A, offline then online return and an unverified local cache; prove that presentation never marks B available from A's document, that A's records are not reused, and that existing `applyBusinessVisibility()` restrictions remain in force; run `node --test tests/ts-052-overview-presentation.test.mjs tests/ts-052-overview-read-state.test.mjs`.
- [ ] 3.2 Add static assertions that the presentation path adds no native subscription, pull, OTP request, network request, database open, read, write, purge, logout, import or export, and no new `localStorage` key, schema field or export field; assert that `#sync-diagnostic`, the diagnostic sharing surface and the retry handler remain unchanged; run `node --test tests/ts-052-overview-presentation.test.mjs`.
- [ ] 3.3 Add assertions that no error message, loader text or new test fixture contains an email, OTP, token, raw identifier, title, note or business record, and that the durable-wait and confirmed-error texts never claim an empty or synchronized Cloud; run `node --test tests/ts-052-overview-presentation.test.mjs`.

### 4. Repository validation

- [ ] 4.1 Run `node --test tests/ts-052-overview-read-state.test.mjs tests/ts-052-overview-presentation.test.mjs` and report the actual result; do not check this task if any test fails.
- [ ] 4.2 Run `npm run check` and report the actual result; do not check this task if any test, backlog check or JavaScript syntax check fails.
- [ ] 4.3 Run `openspec validate ts-052 --strict --no-interactive` and report the actual result; do not check this task if validation fails.

## Manual acceptance

À exécuter sur Chrome Android en portrait et paysage ainsi que sur desktop,
avec une instance Dexie Cloud de test et des données synthétiques uniquement.
Ces vérifications restent **à effectuer** et ne sont pas prouvées par la CI.

- Recharger plusieurs fois Mes projets avec une session existante et une connexion lente : vérifier qu'aucun bandeau de diagnostic ni lien d'alerte n'apparaît puis disparaît pendant `loading`, `connecting`, `initial` et le pull initial, et que la liste réelle apparaît dès qu'elle est disponible.
- Provoquer une lecture bloquante : vérifier que « Chargement de vos projets… » occupe une zone de dimensions stables, qu'aucune liste vide, aucun `0 projet` et aucune suggestion vide n'apparaissent, puis que les projets remplacent le chargement sans saut de hauteur, de focus ou de défilement.
- Avec des projets déjà affichés, déclencher un pull de fond et un retour hors ligne puis en ligne : vérifier qu'aucune animation de chargement ne remplace la liste et que le scroll, le focus et les groupes développés restent stables.
- Provoquer une erreur réelle de stockage ou de lecture, une session expirée, une déconnexion nécessitant une action et un cache non vérifié : vérifier qu'une explication persistante indique la prochaine action sûre, renvoie vers Paramètres > Synchronisation et n'affirme ni base vide ni synchronisation réussie.
- Laisser une lecture se prolonger au-delà du seuil : vérifier que le chargement n'est pas laissé sans explication et que le message d'attente durable est stable et actionnable.
- Tester une bascule compte/base A → B, des événements natifs tardifs et un retour réseau : vérifier l'absence de données de A sous B et le maintien des restrictions de liaison non autorisée.
- Contrôler au clavier, au toucher, avec un lecteur d'écran et avec la préférence de réduction des animations : absence de clignotement, annonces non répétées, focus et ordre de tabulation prévisibles, aucun piège de focus, cibles utilisables et absence de débordement horizontal.
- Vérifier que le diagnostic complet, les commandes OTP, les reprises manuelles et leurs garde-fous restent inchangés dans `#/parametres/synchronisation`, sans synchronisation, écriture, purge, reconnexion ni requête supplémentaire déclenchée par ce changement visuel. Ne pas utiliser de données personnelles ni effectuer de purge réelle.

## Post-sync review

- Après l'étape séparée de synchronisation sémantique OPSX, comparer les deltas canoniques de `overview-project-read-state`, `cloud-sync-lifecycle` et `cloud-settings-hub` avec les exigences et scénarios de ce changement.
- Vérifier l'archive du changement, son contenu versionné et l'absence de modification accidentelle des specs canoniques, archives antérieures, données produit, exports, workflows ASF, secrets ou fichiers protégés.
- Après publication de la PR, contrôler la CI indépendante `check` sur le SHA exact, la protection requise de `main`, le diff de code et de sécurité, puis la fusion, la CI post-fusion et le déploiement GitHub Pages.
- Séparer strictement les tests CI simulés, la recette réelle Chrome Android/desktop et la vérification sur une instance Dexie Cloud de test ; ne présenter aucun test simulé comme preuve de la recette utilisateur et ne pas marquer comme effectuées les vérifications manuelles non réalisées.
