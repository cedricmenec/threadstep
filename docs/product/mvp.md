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

## Acceptance tests
- Data survives a reload in the same browser when localStorage is available.
- Text input is rendered safely without HTML interpretation.
- Import rejects unknown format version, invalid priorities, orphan substeps and duplicates.
- Mobile viewport is supported.
- No key, secret or personal task content is sent to a server.

## Open decisions
- Manual ordering within a priority and automatic archiving are deferred.
- Synchronization between browser devices is explicitly out of scope.
- After first use, gather feedback before elaborating the product.
