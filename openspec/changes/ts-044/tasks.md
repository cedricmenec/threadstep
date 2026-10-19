# Tasks

## 1. Presentation helper and deterministic scenarios

- [ ] 1.1 Create `site/cloud-settings.js` with pure presentation helpers for the onboarding step, sync-page section visibility and overview access-link visibility; verify with unit tests covering local-only, configured-without-session, OTP pending, active, failed and offline inputs.
- [ ] 1.2 Add `tests/ts-044-settings-hub.test.mjs` asserting that onboarding never announces an unreached stage and that the overview access link appears only for Cloud attention states; run `node --test tests/ts-044-settings-hub.test.mjs` and confirm it passes.
- [ ] 1.3 Add `site/cloud-settings.js` to the `node --check` list in `package.json`; run `npm run check` and confirm the syntax check and existing tests pass.

## 2. Integrated synchronization page

- [ ] 2.1 Move `#cloud-config`, `#cloud-activation`, `#auth-panel` and `#workspace-panel` once into named sections « Configuration », « Première activation », « Connexion » and « Espaces de travail » inside `#settings-sync-page`, keeping existing ids, headings and handlers; verify with a static test that each id occurs once and only within the page.
- [ ] 2.2 Add the contextual onboarding status and next-action region inside the synchronization page, using existing activation, auth and diagnostic states; verify with a deterministic test that local, configuration, OTP, review, active and error states map to the expected step.
- [ ] 2.3 Add a distinct `#sync-settings-access` link on the overview and wire its visibility to the helper without changing the non-interactive `#sync-summary`; verify with a static test that the summary contains no button, input, select or retry and that the link targets `#/parametres/synchronisation`.
- [ ] 2.4 Wire route visibility so `applySettingsVisibility` hides or shows the page and its integrated controls without recreating panels; verify with a static test that the navigation paths contain no `bootstrapSyncedDatabase`, `db.open`, `db.cloud.configure`, `setupAuthentication` or `authController` reset call.

## 3. Preserved journeys and existing safeguards

- [ ] 3.1 Add regression assertions that an OTP interaction, an activation review and an error survive a simulated route change and return unchanged; verify with `createAuthController`, the activation reducers and a test that no submit, cancel or consent function is invoked by navigation.
- [ ] 3.2 Add regression assertions for activation consent, stale plan, divergent target, offline state, reload reconstruction and A/B/A workspace transitions using the existing pure modules; verify with `node --test tests/ts-044-settings-hub.test.mjs` and confirm no write occurs in these scenarios.
- [ ] 3.3 Verify that the four workspace actions keep distinct labels, scope text, confirmations, cancellation and backup by extending the static tests; confirm the existing handler bindings remain the only ones used and no destructive call is reachable from navigation.

## 4. Styles, documentation and existing test alignment

- [ ] 4.1 Add styles for the integrated sections, onboarding region and overview access link, including 44 px minimum sizes, focus-visible rules and wrapping at 320 px; add automated tests that assert the required CSS selectors and declarations and the absence of horizontal overflow rules.
- [ ] 4.2 Update `tests/ts-041-navigation.test.mjs` and `tests/ts-043-sync-page.test.mjs` so the expected synchronization page contains the real controls once and no longer asserts descriptive-only placeholders; run the two test files and confirm they pass.
- [ ] 4.3 Update `docs/product/guide-utilisation.md` and `docs/product/acceptance-checklist.md` to describe the single Cloud settings destination, contextual access, preserved OTP/activation state and distinct destructive actions; verify with a documentation static test.
- [ ] 4.4 Run `npm test`, `npm run check` and `openspec validate ts-044 --strict --no-interactive`; report the actual results and do not mark this task complete if any command fails.

## Manual acceptance

À exécuter sur une instance Dexie Cloud de test et des profils navigateurs isolés, jamais sur des données personnelles ; ces vérifications restent à effectuer et ne sont pas prouvées par la CI.

- Sur desktop et smartphone, ouvrir `#/parametres/synchronisation` depuis le menu et depuis Mes projets, vérifier la disposition des sections, l'absence de doublon, la lisibilité à 320 px, les cibles tactiles d'au moins 44 px, la navigation clavier, le focus après changement de route et les annonces d'un lecteur d'écran.
- Partir d'un profil local vierge : vérifier le démarrage sans Cloud, l'usage normal de Mes projets, puis l'accès à la configuration et à l'onboarding depuis Paramètres. Soumettre une URL invalide puis une URL valide, recharger et vérifier la conservation.
- Provoquer un OTP, quitter la page pendant la saisie du code, revenir, vérifier que le formulaire et l'erreur éventuelle sont conservés et qu'aucun code n'est soumis ou redemandé par la navigation. Vérifier expiration et reprise de session selon le flux natif réel.
- Sur un espace local peuplé, démarrer une activation, vérifier l'isolation avant consentement, afficher une revue de plan, quitter et revenir sans perdre la revue, puis vérifier qu'aucune copie n'a lieu sans opt-in et confirmation. Tester l'annulation et constater que source et cible restent intactes.
- Avec deux navigateurs et un compte de test connecté, vérifier le même workspace, les tâches et les statuts de diagnostic après refresh, changement de page et reconnexion. Provoquer une divergence, un état hors ligne, une erreur réseau et un pull initial non vérifié : vérifier que les tâches locales restent accessibles et qu'aucune base vide n'est affirmée.
- Tester séparément « Changer d'espace », « Suspendre Cloud », « Se déconnecter » et « Purger la copie locale » : vérifier les libellés, le nom de base, la portée, l'avertissement sur les écritures non transmises, l'export de sécurité, l'annulation et les confirmations. Vérifier qu'aucune donnée distante ni autre espace n'est détruit.
- Vérifier le parcours A/B/A d'URL et la transition entre espace autonome et espace synchronisé, ainsi que la conservation des données et du diagnostic après chaque changement.

## Post-sync review

- Comparer les deltas OpenSpec réellement synchronisés aux exigences de cette proposition, en particulier `cloud-settings-hub`, `app-navigation` et `cloud-sync-lifecycle`.
- Vérifier l'archive du changement et son contenu versionné.
- Après publication, contrôler la CI indépendante sur le SHA exact de la PR, la protection de branche, le diff de code et de sécurité, puis la fusion et la CI `main`/Pages.
- Séparer ces contrôles de la recette manuelle réelle et ne déclarer aucune preuve de compte Dexie ou d'appareil qui n'aurait pas été effectivement exécutée.
