# Tasks

## 1. Pure update logic in `site/core.js`

- [ ] 1.1 Add a pure `updateItem(document, subjectId, itemId, patch)` to
  `site/core.js` that returns a new document changing only `title`/`priority`
  and returns the original reference for a missing subject/item, an invalid
  patch or an unchanged value; verify with `node --check site/core.js`.
- [ ] 1.2 Add unit tests in `tests/core.test.mjs` covering a valid rename plus
  reprioritize: only `title` and `priority` change, all other fields and other
  items/subjects are preserved, and the input document is not mutated; verify
  with `npm test`.
- [ ] 1.3 Add unit tests for invalid and no-op edits (blank, whitespace-only,
  trimmed title over 300 characters, unknown priority, identical values) and
  assert the original document reference is returned; verify with `npm test`.
- [ ] 1.4 Add unit tests asserting parent/substep `id`, `done`, `parentId` and
  unrelated fields survive an edit and that the result passes
  `parseDocument(JSON.stringify(...))`; verify with `npm test`.

## 2. Edit UI in `site/app.js` and `site/styles.css`

- [ ] 2.1 Render an accessible French « Modifier » button for each action and
  substep with a label naming that action, and wire it to open the editor;
  verify by keyboard and touch/mouse that the editor opens for the right item.
- [ ] 2.2 Build the inline editor prefilled with the current title and priority
  select (urgent, normal, later) plus « Enregistrer » and « Annuler », using a
  `maxlength="300"` title input; verify it shows the current values and both
  controls.
- [ ] 2.3 Wire save through `updateItem` plus the existing `persist()` and
  re-render; verify that renaming « Appeler Paul » to « Relancer Paul » and
  switching normal→urgent updates the title, badge and same-level order and
  survives a reload.
- [ ] 2.4 Wire « Annuler » to close the editor without calling `persist()`;
  verify the original title and priority remain after cancel and after reload.
- [ ] 2.5 Show an understandable validation indication for blank/whitespace-only
  or over-300-character titles and leave the stored action untouched; verify
  both cases manually and via `npm run check`.
- [ ] 2.6 Add inline-editor styles in `site/styles.css` and ensure rendered
  titles use safe text nodes; verify a title containing markup is shown
  literally and the editor stays usable at a mobile viewport.

## 3. Accessibility, hierarchy and integration checks

- [ ] 3.1 Manage focus after save and cancel to the edited action's
  « Modifier » control, following the item when a priority change reorders it;
  verify with keyboard-only navigation.
- [ ] 3.2 Verify in the browser that editing a parent preserves its nested
  substeps and editing a substep preserves its parent, and that JSON export
  followed by import keeps the updated fields; verify by round-tripping a file.
- [ ] 3.3 Run `npm run check` and confirm the unit tests plus the `core.js` and
  `app.js` syntax checks all pass.

## Workflow follow-up

- Do not archive during implementation; archive only through the project's
  reviewed process after every tracked task is checked.
- Confirm no protected path changed and independent CI passes before merge.
