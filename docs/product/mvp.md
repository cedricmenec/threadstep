# MVP specification

**État : 15 octobre 2026.** Les fonctions FR-02 (annulation du retrait)
et FR-15 (ordre manuel à priorité égale) sont livrées par les
[PR #32](https://github.com/cedricmenec/threadstep/pull/32) et
[PR #34](https://github.com/cedricmenec/threadstep/pull/34).
Le comportement utilisateur est détaillé dans
[le guide d'utilisation](guide-utilisation.md). Les spécifications
canoniques sont dans `openspec/specs/action-removal/` et
`openspec/specs/action-ordering/`.

## Functional requirements
- FR-01 Create and remove named subject groups.
- FR-02 Add, complete and remove short next-action items in each subject. Removal is immediate and persisted, and offers a non-modal 10-second undo snackbar (« Étape retirée » / « Annuler ») that restores the removed action and its substeps exactly (ids, titles, priorities, completion flags, parent relations and order); the window is tab-local, invalidated by subject removal, JSON import or another tab's local update, and never survives a reload nor creates a new storage key.
- FR-03 Group one level of nested substeps under a parent action.
- FR-04 Prioritize actions as urgent, normal or later, displayed in that order per level.
- FR-05 See the number of unfinished actions across subjects.
- FR-06 Save automatically on this browser in localStorage.
- FR-07 Export state to JSON and import with schema validation and confirmation before replacement.
- FR-08 Serve as static files via GitHub Pages at a repository subpath.
- FR-09 Reorder subjects one position at a time using accessible up/down controls. Preserve the subject order across reload, JSON export and import.
- FR-10 Edit the title and priority of an existing action or one-level substep with explicit save/cancel, validation, accessible controls and automatic local persistence. Preserve IDs, completion flags, parent relations, document version and JSON import/export.
- FR-11 Temporarily hide completed actions and substeps using an accessible view toggle, keeping completed parents visible when they have unfinished substeps. Never modify stored data or JSON exports through filtering.
- FR-12 Offer a deterministic, view-only « Une étape pour maintenant » suggestion of exactly one unfinished top-level action, prioritizing urgency then subject order then item order, with an accessible way to locate it in the list. Only unfinished top-level actions are eligible: completed actions, substeps and completed parents are excluded, and a clear friendly empty state is shown when none exists. The suggestion is recomputed on each activation, never modifies stored data or JSON, and is not persisted across reload. Substeps as candidates, randomness, AI, timers and automatic completion are out of scope.

- FR-13 Let the user explicitly pin exactly one unfinished top-level action as « Je reprends ici » using an accessible French control on each eligible action. Show a single top-of-interface card with the subject, title and priority plus « Voir dans la liste » and « Ne plus suivre »; restoring the selection locally after reload, revealing it accessibly (including on mobile and when completed actions are hidden), replacing it when another action is pinned, and clearing it explicitly or automatically when the tracked action is completed or removed, when its subject is removed, or when an import no longer contains it. Track the stable subject and action IDs (never title or position), keep TS-007 suggestions independent, leave IDs, priorities, completion flags and ordering untouched, and preserve document JSON compatibility by storing this browser-only preference separately and excluding it from exports.

- FR-14 Explain in accessible French why the deterministic « Une étape pour maintenant » suggestion was selected, using its effective priority (urgent, normal or later) and the existing tie-break order of earlier subject order then earlier action order. The explanation is shown only with a valid suggestion, invents no criterion beyond that order, does not alter selection or stored data, remains distinct from « Je reprends ici », and never invokes AI/network or introduces new persistence.

- FR-15 Let the user rank top-level actions manually inside each priority group using a visible French drag handle (mouse, finger or stylus) or accessible « Monter »/« Descendre » controls that move an action one rank and are disabled at the group boundaries. Reordering stays inside the same subject and priority: a drop on another subject, another priority, a substep, empty space or an invalid target is refused with no document mutation and no storage write; priorities never change, substeps follow their parent, and reordering is suspended while completed steps are hidden with a short French explanation. The chosen order is stored in the existing `subject.items` array with no new field, no document version change and no new storage key, survives reload and JSON export/import, and keeps the deterministic suggestion, the « Je reprends ici » tracking and the removal undo coherent.

## Acceptance tests
- Data survives a reload in the same browser when localStorage is available.
- Text input is rendered safely without HTML interpretation.
- Import rejects unknown format version, invalid priorities, orphan substeps and duplicates.
- Removing an action or substep persists immediately and shows a snackbar « Étape retirée » with « Annuler »; undoing within ten seconds restores the exact action and its substeps and re-persists, while expiry, reload, subject removal, import or an external localStorage update prevent any stale restoration and no new storage key is created.
- Mobile viewport is supported.
- The « Une étape pour maintenant » suggestion is deterministic, excludes completed actions and substeps, and never changes localStorage, exported JSON, ids, flags, priorities or ordering; no card is restored after reload.
- The « Je reprends ici » tracking pins exactly one unfinished top-level action, survives reload, reveals it accessibly, clears on « Ne plus suivre », and is automatically cleaned up when the action is completed or removed or its subject is removed; it uses a browser-local preference separate from `threadstep.document.v1`, is excluded from JSON exports, and never changes ids, priorities, completion flags or ordering.
- No key, secret or personal task content is sent to a server.

- The « Une étape pour maintenant » explanation names the suggested action's effective priority (urgent/normal/later) in French, states the existing tie-break order of earlier subjects then earlier actions without inventing other criteria, and is shown only with a valid suggestion; activating the suggestion, reading the explanation and using « Voir dans la liste » leave localStorage, exported JSON and the « Je reprends ici » tracking unchanged.

- Top-level actions can be reordered within their priority group by dragging the handle or using « Monter »/« Descendre »; cross-subject, cross-priority, substep and empty-space drops change nothing and write no storage; the order survives reload, export and import while ids, priorities, completion flags, parents and the document version stay unchanged; while « Masquer les étapes terminées » is active no handle is shown and the move controls are disabled with a French explanation.

## Open decisions
- Manual ordering within a priority is delivered in FR-15; automatic archiving remains deferred.
- Synchronization between browser devices is explicitly out of scope.
- After first use, gather feedback before elaborating the product.

## Delivery verification and remaining manual checks

- Merged product PRs: [TS-010 #32](https://github.com/cedricmenec/threadstep/pull/32) and [TS-011 #34](https://github.com/cedricmenec/threadstep/pull/34).
- [Post-merge CI on main](https://github.com/cedricmenec/threadstep/actions/runs/38755434920): 97 Node tests passed; Actionlint and strict OpenSpec validations passed.
- [GitHub Pages deployment](https://github.com/cedricmenec/threadstep/actions/runs/38755434958): successful.
- These automated checks do **not** establish a complete manual touch-device, focus/keyboard or screen-reader acceptance campaign. That remains a user validation activity, not a reason to describe TS-010/011 as unimplemented.
