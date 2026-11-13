# Tasks

## 1. Style the inline editor

- [x] 1.1 Add a softly tinted, token-based surface, subtle border, rounded corners and modest internal spacing to `.task-edit-form`; verify both existing editor render paths use the shared class and remain wrapped within their container.
- [x] 1.2 Add a deterministic presentation test that checks the editor surface tokens, box sizing and retained responsive containment; run the test and confirm it passes.

## 2. Validate the implementation before sync

- [x] 2.1 Run `npm run check`, `npm run build`, `npm run verify:build` and strict validation of this OpenSpec change; confirm all complete successfully before synchronizing specs.

## Manual acceptance

Open a task editor on desktop and phone widths. Inspect a long title, note field, validation message, keyboard focus and touch controls. Confirm the editor is visibly distinct, fits the viewport and keeps the same fields and controls. Record only checks actually performed.

## Workflow follow-up

- Synchronize the validated `action-editing` spec delta to the canonical specs, then archive this change.
- Validate all active and archived OpenSpec changes after archive.

## Post-sync review

Compare the synchronized canonical requirement with the delta, verify the archive and strict validators, review the implementation diff, then verify the independent PR CI, merge result, CI on `main` and Pages deployment. Do not claim physical-device acceptance unless it was performed.
