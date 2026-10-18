# Tasks

## 1. Local workspace foundation

- [ ] 1.1 Add the autonomous local Dexie schema/bootstrap in `site/dexie-foundation.js` with a dedicated stable database name, the existing explicit schema version, the `subjects`/`items` string-key stores and the non-destructive upgrade; verify `node --test tests/dexie-foundation.test.mjs` asserts the distinct name, explicit version, no `++id`, no Dexie Cloud addon and no `db.cloud.configure()` in the local bootstrap.
- [ ] 1.2 Add deterministic tests showing that a compatible local schema upgrade keeps existing records and that UUID/`legacy:` identifiers stay stable strings; verify `node --test tests/dexie-foundation.test.mjs` fails if the local bootstrap deletes, clears or recreates the workspace.
- [ ] 1.3 Register any new local workspace module or schema dependency in `package.json` `check` only if a new site file is introduced; verify `node --check <file>` succeeds and `npm run check` still includes every site module.

## 2. IndexedDB business path in local mode

- [ ] 2.1 Extract or add a reusable transactional Dexie store adapter in `site/persistence.js` and use it for the local database; verify `node --test tests/local-persistence.test.mjs` covers `commit(operations)`, local error kinds and zero network calls with a fake database.
- [ ] 2.2 Replace the local business `load`, `persist`, import and export paths in `site/app.js` with the local IndexedDB store; verify deterministic tests or static assertions show that business reads use the local records, writes call `businessStore.commit`, import is one operation set and no business `localStorage.setItem(STORAGE_KEY)` or `localStorage.getItem(STORAGE_KEY)` path remains.
- [ ] 2.3 Wire startup so a valid Cloud configuration keeps the synchronized workspace while the absence of a valid configuration opens the local workspace without an auth controller or OTP; verify static tests assert both branches, the local business visibility and the unchanged synchronized bootstrap.
- [ ] 2.4 Build local JSON export from the committed `recordsToDocument` projection and keep the V1 shape, ids, `parentId`, order, priority, `done` and optional `note`; verify `node --test tests/local-persistence.test.mjs` covers export/import round-trip and the absence of Cloud configuration from the export.
- [ ] 2.5 Add deterministic create/edit/delete/reload tests for the local adapter and a tree with parent/child steps; verify the same committed records and relations are restored after reload and no partial subset survives an interrupted operation set.
- [ ] 2.6 Add static assertions that the local business view is rendered without a Cloud identity, that no OTP panel gates it and that the pure `site/core.js` remains free of storage, network and DOM access; verify the assertions pass under `node --test`.

## 3. Fail-closed local storage and privacy

- [ ] 3.1 Implement explicit local open, read and commit error states with user-visible messages distinct from network or synchronization errors, and no silent fallback to `localStorage` as the business store; verify `node --test tests/local-persistence.test.mjs` and static assertions cover each state.
- [ ] 3.2 Add deterministic tests for a failed transaction (no success, previous state preserved, no partial records), unavailable IndexedDB at open and a read failure that does not render an empty authoritative dashboard; verify the legacy export remains available when the historical key is readable.
- [ ] 3.3 Add privacy assertions proving that local-only bootstrap contains no Cloud configuration, no `fetch`, `XMLHttpRequest`, `WebSocket` or `sendBeacon` call and no remote transfer queue; verify the assertions pass and the export contains no URL, OTP, credential or secret.
- [ ] 3.4 Add static semantic-DOM assertions for the local status and error surfaces (`role="status"`/`role="alert"`, `textContent`, no `innerHTML`) and for the availability of the local business controls without authentication; verify the assertions pass under `node --test`.

## 4. Non-destructive legacy V1 transition

- [ ] 4.1 Add the local legacy-preservation notice and its historical export control using `availableLocalBackup(localStorage)`; verify static DOM assertions cover the notice text, the export control and the absence of an automatic conversion control.
- [ ] 4.2 Add deterministic tests that startup, create, edit, delete, reload and a failed local transaction leave the `threadstep.document.v1` value byte-for-byte unchanged; verify no `removeItem(STORAGE_KEY)`, rename, overwrite or automatic migration is reachable.
- [ ] 4.3 Add tests that the historical export still returns the exact stored V1 JSON and that no historical record is copied into the local workspace without an explicit conversion; verify the local workspace remains empty when only the legacy key exists.
- [ ] 4.4 Add static assertions that the legacy notice is not an authentication gate, that the local dashboard remains available while it is shown and that the resume preference stays outside IndexedDB and outside the export.

## 5. Documentation and compatibility notes

- [ ] 5.1 Update `docs/product/developer-guide.md`, `docs/product/mvp.md`, `docs/product/dexie-cloud-rollout.md` and `docs/product/acceptance-checklist.md` to describe IndexedDB as the default local store, the separate synchronized workspace, the untouched legacy key and the TS-033/TS-037 boundaries; verify documentation tests assert these concepts.
- [ ] 5.2 Update static documentation tests to require the local-first startup, the absence of a business `localStorage` path, the legacy export and the narrative non-runner section; verify `node --test tests/*.test.mjs` passes.

## 6. Integration verification

- [ ] 6.1 Run `npm run check`; report the actual test, backlog and syntax results and do not mark this task done if any command fails.
- [ ] 6.2 Run `openspec validate ts-032 --strict --no-interactive`; report the actual result and do not mark this task done if validation fails.
- [ ] 6.3 Run `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-032/tasks.md`; report the actual result and keep every non-runner check outside the implementation checklist.

## Manual acceptance

Ces vérifications exigent un vrai navigateur, un appareil mobile ou une observation humaine. Elles restent **à vérifier** et ne sont pas accomplies par un test Node ni par la CI.

- Sur Chrome mobile, sans URL Cloud et hors ligne, ouvrir l'application, créer des sujets et des étapes, les modifier, en supprimer, puis recharger. Vérifier que les mêmes données reviennent depuis IndexedDB et qu'aucun OTP ni écran de configuration Cloud ne bloque la vue métier.
- Avec un ancien `threadstep.document.v1` présent, vérifier dans les outils du navigateur que la clé est intacte, que l'export historique reste disponible et qu'aucune conversion ou transmission Cloud automatique n'a eu lieu.
- Bloquer ou saturer IndexedDB dans le navigateur, puis vérifier le message d'erreur local, l'absence de faux succès et la possibilité d'exporter une sauvegarde encore lisible.
- Parcourir au clavier et au lecteur d'écran la vue locale, la notice historique, le bouton d'export et les états d'erreur; vérifier le focus, les noms accessibles et les cibles tactiles.
- Observer l'onglet Réseau du navigateur pendant le premier lancement et les mutations locales sans Cloud; confirmer l'absence d'appel Dexie Cloud, d'OTP et de requête portant le contenu métier.

## Post-sync review

- Après OPSX sync, comparer les deltas canoniques produits avec les exigences modifiées de `local-indexeddb-persistence`, `dexie-cloud-configuration`, `dexie-local-database`, `local-first-business-persistence` et `threadstep-integration-profile`.
- Contrôler l'archive du changement, son contenu versionné et l'absence de modification des archives historiques, des workflows, secrets ou fichiers protégés ASF.
- Après publication de la PR, vérifier le check GitHub indépendant sur son SHA exact, la protection requise et les preuves de fusion.
- Vérifier séparément la CI de `main` et le déploiement GitHub Pages après fusion.
- Confirmer que la recette manuelle Chrome mobile a réellement été effectuée et consigner séparément les résultats; une CI verte ne prouve ni IndexedDB réel, ni hors ligne, ni tactile, ni lecteur d'écran.
