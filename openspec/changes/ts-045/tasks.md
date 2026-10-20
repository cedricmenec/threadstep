# Tasks

## Implementation checklist (apply, before OPSX sync)

### 1. Reproduction and durable binding core

- [ ] 1.1 Add `tests/ts-045-binding-bootstrap.test.mjs` with deterministic fixtures for a registry entry missing its digest while a matching activation attestation exists, re-registration with an existing `remoteDbId`, a refused localStorage binding write, a delayed native identity, two concurrent read-modify-write cycles and an observed `remoteDbId` mismatch; run `node --test tests/ts-045-binding-bootstrap.test.mjs` and record which fixtures fail against the pre-change behavior.
- [ ] 1.2 Implement in `site/workspace-identity.js` a deterministic binding-evidence resolver that adopts a local activation attestation only for the same URL and base with absent or equal remote identifiers, and fails closed on divergence; verify the rehydration and divergence fixtures from 1.1 pass.
- [ ] 1.3 Implement an idempotent binding merge/write that re-reads the registry, preserves an existing `userDigest` and `remoteDbId`, refuses to erase attested fields with absent values, reads back the result and reports failure without allowing business reads; verify the refused-write and concurrent-tab fixtures pass.
- [ ] 1.4 Preserve `remoteDbId` and binding fields across `registerWorkspace` and status updates, and verify reload/A-B-A idempotence with unit tests in `tests/ts-045-binding-bootstrap.test.mjs`.

### 2. Redacted bootstrap trace and classifier

- [ ] 2.1 Add `site/bootstrap-diagnostics.js` with a closed allowlist of bootstrap event codes, a bounded event count and no free-text fields; add unit tests asserting the bound, rejection of unknown events and absence of sample email, OTP, token, raw user id, title and note.
- [ ] 2.2 Implement a pure bootstrap cause classifier with stable categories and origins for historical unattested cache, first pull before binding, recovered prior attestation, binding write failure, delayed identity, account change, destination change, missing attestation and indeterminate evidence; verify every path with unit tests.
- [ ] 2.3 Expose the redacted classification through `site/sync-diagnostics.js` return values, rows and summary without merging it into remote evidence; verify with tests that `in-sync`, a completed pull or a local read cannot produce a business-convergence claim.
- [ ] 2.4 Add `site/bootstrap-diagnostics.js` to the `node --check` list in `package.json` and run `npm run check`; confirm the syntax check and existing tests pass.

### 3. Bootstrap ordering, protections and transitions

- [ ] 3.1 Record the bootstrap stages in `site/app.js` from configuration through the first business read, and classify an unverified state before rendering the recovery action; verify with static integration tests that no business read precedes binding evaluation.
- [ ] 3.2 Re-evaluate binding on relevant `currentUser` and `persistedSyncState` changes with a monotonic generation, so delayed identity or pull events cannot leave a stale unverified state or overwrite a newer binding; verify with deterministic event-order fixtures and static assertions on `site/app.js`.
- [ ] 3.3 Enforce observed `remoteDbId` coherence before business reads while leaving an attested local binding readable when fresh remote evidence is absent; verify both outcomes with unit and static integration tests.
- [ ] 3.4 Preserve fail-closed behavior for a populated unverified cache, a different account, a missing attestation and pending mutations: no business read, export or transfer, and no automatic recovery base; verify with integration tests and static assertions.
- [ ] 3.5 Preserve non-destructive transitions for A/B/A, suspension/resume, logout, explicit purge, expired session and offline state, including other caches, pending mutations, export and remote data; verify by extending `tests/workspace-identity.test.mjs` and the static tests for `site/app.js`.
- [ ] 3.6 Keep the isolated recovery explicit and available only for a recoverable unverified state; verify with static tests that bootstrap and reload paths never call the recovery confirmation or physically delete a database.

### 4. Diagnostic surface, documentation and validation

- [ ] 4.1 Expose the redacted binding/bootstrap category in `#/parametres/synchronisation` while preserving the existing `aria-live` status; verify with static and DOM-model tests that labels are French, read-only and free of sample personal or business content.
- [ ] 4.2 Add to `docs/architecture.md` the regression matrix for fresh profile, historical profile, Android/laptop, local-to-Cloud and Cloud-to-local, A/B/A, account/URL changes, reload, concurrent tabs, offline, pending mutations and expired session, plus the redaction and investigation rules; verify with a documentation static test.
- [ ] 4.3 Update existing `tests/workspace-identity.test.mjs`, `tests/sync-diagnostics.test.mjs` and static `site/app.js` tests for the new diagnostic rows and binding sequence; run those files and confirm they pass.
- [ ] 4.4 Run `npm test`, `npm run check` and `openspec validate ts-045 --strict --no-interactive`; report the actual results and do not check this task if any command fails.

## Manual acceptance

À exécuter sur une instance Dexie Cloud **isolée**, avec des profils navigateurs et appareils de test, jamais sur des données personnelles. Ces vérifications restent à effectuer et ne sont pas prouvées par la CI.

- Établir une baseline datée et versionnée : profil neuf et profil historique, export de secours vérifié, deux navigateurs ou appareils distincts (dont Android et laptop), origine autorisée et compte de test.
- Sur le profil nominal déjà lié, enchaîner première connexion, rechargements multiples, navigation entre pages, reconnexion OTP avec le même compte, retour réseau et synchronisation. Vérifier que les mêmes projets et tâches restent visibles, que la base locale effective ne change pas, qu'aucun nouveau cache de récupération n'est créé et qu'aucune donnée n'est copiée.
- Provoquer un état historiquement non vérifiable (cache legacy peuplé sans attestation, puis cache rempli par un premier pull avant liaison) et vérifier que les données restent masquées, que la cause affichée distingue l'état historique d'une régression, et que la récupération isolée reste explicite, non destructive et laisse l'ancien cache intact.
- Tester un changement de compte sur la même URL, un changement de `remoteDbId`, une attestation distante absente, une session expirée et des mutations en attente. Vérifier qu'aucune donnée métier de l'ancien cache n'est révélée, exportée ou transférée sans preuve et consentement, et qu'aucune purge ne se déclenche automatiquement.
- Tester A/B/A, bascule local↔Cloud, suspension puis reprise, déconnexion et purge confirmée. Vérifier que chaque espace retrouve ses données, que les autres bases et la source autonome restent intactes, et que les confirmations, l'export et les avertissements existants fonctionnent toujours.
- Tester hors ligne, deux onglets concurrents, rechargement pendant le bootstrap et événements natifs retardés. Vérifier l'absence de faux blocage durable, l'absence d'écrasement de liaison et la conservation des mutations en attente.
- Comparer le contenu métier réel des deux côtés (projets et tâches) après reconnexion et sur le second appareil ; ne pas déduire la convergence d'un état `in-sync`, d'un pull attesté ou d'une lecture locale. Vérifier que le diagnostic et la trace expurgée ne contiennent ni email, ni OTP, ni jeton, ni identifiant utilisateur brut, ni URL brute, ni titre, ni note.
- Consigner la date, la version, les navigateurs/appareils, l'instance de test, les résultats observés et les limites, sans donnée sensible. Une cause non reproduite doit être rapportée comme indéterminée, pas inventée.

## Post-sync review

- Comparer les deltas OpenSpec réellement synchronisés aux exigences de cette proposition, notamment `workspace-identity-isolation` et `cloud-sync-lifecycle`.
- Vérifier l'archive du changement et son contenu versionné, ainsi que l'absence de modification accidentelle des spécifications canoniques ou des archives antérieures.
- Après publication, contrôler la CI indépendante sur le SHA exact de la PR, la protection de branche, le diff de code et de sécurité, puis la fusion, la CI `main` et le déploiement GitHub Pages.
- Séparer strictement les tests CI, la recette réelle sur instance Dexie Cloud isolée et les preuves multi-appareils ; ne présenter aucun test simulé comme preuve de convergence réelle.
