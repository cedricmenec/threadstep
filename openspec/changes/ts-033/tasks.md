# Tasks

## 1. Source fingerprint and strict local detection

- [x] 1.1 Extract the existing synchronous SHA-256 implementation into a new pure `site/fingerprint.js`, import it from `site/migration-reconciliation.js` and keep its public re-export; verify `node --test tests/migration-reconciliation.test.mjs` still passes the known `sha256Hex("abc")` vector and `node --check site/fingerprint.js site/migration-reconciliation.js` succeeds.
- [x] 1.2 Add `site/local-migration.js` with a source detector that returns the raw string, the strictly parsed V1 document and the SHA-256 source fingerprint, and typed absent, invalid, unreadable and unavailable results; verify deterministic `node --test tests/local-migration.test.mjs` cases show invalid, absent and unreadable values produce no plan and no target write.
- [x] 1.3 Add the new modules to the `package.json` `check` script; verify deterministic assertions in `tests/local-migration.test.mjs` require both `node --check site/fingerprint.js` and `node --check site/local-migration.js` in the script and that `npm run check` parses every site module.

## 2. Lossless projection and non-recursive identifiers

- [x] 2.1 Implement the local projection and mapping with a non-recursive option that leaves an identifier already starting with `legacy:` unchanged while mapping `id`, `subjectId` and `parentId` consistently; verify deterministic tests cover nested substeps, notes, priorities, order, `done`, parent references and the absence of any `legacy:legacy:` value.
- [x] 2.2 Implement `planLocalConversion` with the `ready`, `already-migrated`, `populated`, `collision` and invalid source statuses, emitting only `put` operations for absent records and no operation for identical records; verify deterministic tests assert the operation stores/types, the absent/identical classification and that planning has no side effect on the target.
- [x] 2.3 Add a deterministic 5-subject/18-step fixture and verify a confirmed local conversion, then a reload from the in-memory store snapshot, restores all 5 subjects, 18 steps, their relation tree, notes, priorities, order and `done` values.
- [x] 2.4 Implement resume-preference remapping for source identifiers that exist in the document and verify deterministic tests show it resolves to the converted subject/step, stays out of the records and export, and leaves an unreferenced preference untouched.

## 3. Consent, stale plans, atomic execution and provenance

- [x] 3.1 Implement `runLocalConversion` with a consent bound to the plan fingerprint, re-reading the source and target before commit; verify deterministic tests show refusal, a mutated source and a mutated target each produce no commit, no provenance write and a typed refusal or stale result.
- [x] 3.2 Verify a forced commit failure leaves the target unchanged, writes no provenance or resume preference, returns a failure status and keeps the historical raw string byte-for-byte identical.
- [x] 3.3 Implement the non-synchronized `threadstep.migration.v1` provenance record with source fingerprint, mapping version, local target, completion status and converted counts, and verify deterministic tests show it contains no title/note business content, survives a re-read and distinguishes local completion from Cloud activation.
- [x] 3.4 Verify a second conversion of the same source emits zero operations, a partially populated target receives only missing records while keeping unrelated records, and a conflicting identifier blocks the write while preserving the existing local record.

## 4. Local review surface and Cloud isolation

- [x] 4.1 Add the local conversion control and review surface in `site/index.html`, `site/app.js` and `site/styles.css` using semantic buttons, a checkbox, labels, fieldsets where relevant, `textContent` rendering and a live status; verify static deterministic assertions cover the control ids, accessible names, consent gate and the absence of `innerHTML` in the rendering path.
- [x] 4.2 Wire confirmation only in local mode through `businessStore.read()` and `businessStore.commit()`, then `refreshLocalDocument()`; verify static assertions show the local conversion path does not call `bootstrapSyncedDatabase`, `readAttestedTarget`, `db.cloud`, `fetch`, `XMLHttpRequest` or `sendBeacon`.
- [x] 4.3 Verify deterministic tests and static assertions show every outcome (success, refusal, stale source, collision, transaction failure) keeps `threadstep.document.v1` and the `availableLocalBackup` export byte-for-byte available, and that the local notice can report a completed local conversion without claiming Cloud synchronization.

## 5. Documentation and non-regression

- [x] 5.1 Update `docs/product/developer-guide.md`, `docs/product/mvp.md`, `docs/product/dexie-cloud-rollout.md` and `docs/product/acceptance-checklist.md` to describe the explicit V1-to-local conversion, the 5-subject/18-step reload expectation, the non-destructive source retention and the TS-037 Cloud boundary; verify documentation assertions in `tests/local-migration.test.mjs` require these concepts.
- [x] 5.2 Add deterministic privacy assertions that the local conversion module and local confirmation path contain no Cloud configuration, OTP, network API or transfer queue, and verify the assertions pass under `node --test`.
- [x] 5.3 Verify the existing migration, persistence, local-recovery and reconciliation test suites still pass unchanged in behavior; report any updated expectation explicitly in the apply result.

## 6. Integration verification

- [x] 6.1 Run `npm run check` and report the exact test, backlog and syntax results; do not mark this task done if any command fails.
- [x] 6.2 Run `openspec validate ts-033 --strict --no-interactive` and report the exact result; do not mark this task done if validation fails.
- [x] 6.3 Run `node scripts/check-openspec-task-phases.mjs openspec/changes/ts-033/tasks.md` and report the exact result; keep every non-runner check outside the implementation checklist.

## Manual acceptance

Ces vérifications exigent un vrai navigateur, un appareil mobile ou une observation humaine. Elles restent **à vérifier** et ne sont pas accomplies par un test Node ni par la CI.

- Sur Chrome mobile, avec un document V1 réel de 5 sujets et 18 étapes, conserver d'abord un export de secours, puis convertir en local sans configurer Cloud. Recharger et comparer visuellement les sujets, les étapes et les sous-étapes, leurs notes, priorités, ordres et états terminés.
- Dans les outils du navigateur, vérifier que `threadstep.document.v1` et son export historique sont inchangés, que la clé de provenance ne contient aucun contenu métier et qu'aucune base Cloud ni aucune requête OTP n'a été créée.
- Refuser la conversion, relancer la même conversion, présenter un V1 invalide, utiliser une cible partiellement peuplée puis provoquer un échec de transaction (stockage bloqué ou saturé) et vérifier l'absence de doublon, d'écrasement et de demi-document après chaque tentative.
- Parcourir au clavier et au lecteur d'écran la prévisualisation locale, la case de consentement, les boutons de confirmation/refus et les messages de statut; vérifier le focus, les noms accessibles et les cibles tactiles.
- Observer l'onglet Réseau pendant toute la conversion locale et confirmer l'absence de configuration Dexie Cloud, d'OTP, de push et de requête portant le contenu métier.
- Ces vérifications restent en attente de preuve humaine et ne comportent aucune case à cocher.

## Post-sync review

- Après OPSX sync, comparer les deltas canoniques produits pour `legacy-storage-migration`, `threadstep-integration-profile` et `legacy-document-migration` au comportement décrit dans `proposal.md`, `design.md` et les specs cibles.
- Contrôler l'archive du changement, son contenu versionné et l'absence de modification rétroactive des archives historiques, des workflows, secrets ou fichiers protégés ASF.
- Après publication de la PR, vérifier le check GitHub indépendant sur son SHA exact, la protection requise et les preuves de fusion.
- Vérifier séparément la CI de `main` et le déploiement GitHub Pages après fusion.
- Confirmer que la recette Chrome mobile a réellement été effectuée et consigner séparément ses résultats; une CI verte ne prouve ni IndexedDB réel, ni rechargement, ni visuel mobile, ni lecteur d'écran.
