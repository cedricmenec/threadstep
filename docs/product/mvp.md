# MVP specification

## Functional requirements
- FR-01 Create and remove named subject groups.
- FR-02 Add, complete and remove short next-action items in each subject.
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

## Acceptance tests
- Data survives a reload in the same browser when localStorage is available.
- Text input is rendered safely without HTML interpretation.
- Import rejects unknown format version, invalid priorities, orphan substeps and duplicates.
- Mobile viewport is supported.
- The « Une étape pour maintenant » suggestion is deterministic, excludes completed actions and substeps, and never changes localStorage, exported JSON, ids, flags, priorities or ordering; no card is restored after reload.
- The « Je reprends ici » tracking pins exactly one unfinished top-level action, survives reload, reveals it accessibly, clears on « Ne plus suivre », and is automatically cleaned up when the action is completed or removed or its subject is removed; it uses a browser-local preference separate from `threadstep.document.v1`, is excluded from JSON exports, and never changes ids, priorities, completion flags or ordering.
- No key, secret or personal task content is sent to a server.

## Open decisions
- Manual ordering within a priority and automatic archiving are deferred.
- Synchronization between browser devices is explicitly out of scope.
- After first use, gather feedback before elaborating the product.
