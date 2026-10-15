# Tasks

## 1. Pure explanation helper

- [ ] 1.1 Add `suggestionReason(priority)` to `site/core.js` returning the fixed
  French sentence for `urgent`, `normal` and `later`, and `null` for any other
  value, without mutating anything; verify with `node --check site/core.js`.
- [ ] 1.2 Add unit tests in `tests/core.test.mjs` asserting the exact
  deterministic string for each of the three priorities, `null` for an invalid
  priority and identical output on repeated calls; verify with `npm test`.

## 2. Card rendering and style

- [ ] 2.1 In `site/app.js`, append the explanation as a
  `<p class="focus-reason">` text node built with `el()` in the valid-suggestion
  branch of `renderSuggestion()`, between `focus-meta` and the actions, leaving
  the empty-state branch unchanged; verify by activating the control that the
  reason appears with a suggestion and that no reason appears in the empty
  state.
- [ ] 2.2 Add a `.focus-reason` style in `site/styles.css` that stays readable
  and wraps at a mobile viewport without horizontal scrolling; verify at a
  narrow viewport with no new dependency.
- [ ] 2.3 Verify the reason is announced with the card in the existing
  `aria-live` region and contains no user-provided data and no HTML; verify with
  a suggested title containing `<img src=x onerror=alert(1)>`.

## 3. Product documentation

- [ ] 3.1 Update `docs/product/mvp.md` to mark FR-14 implemented (remove the
  "Planned in TS-009, not yet implemented" marker), state that the explanation
  uses the effective priority and the existing tie-break order and changes
  nothing else, and align its acceptance test; verify the text matches the
  shipped behavior and that `docs/factory/` is untouched.

## 4. Integration verification

- [ ] 4.1 Verify that activating the suggestion control, reading the reason and
  using « Voir dans la liste » change nothing: compare `localStorage`
  (`threadstep.document.v1` and `threadstep.resume.v1`), ids, done flags,
  priorities, item order, subject order and a fresh JSON export before and
  after, and confirm the TS-008 tracked action is unchanged.
- [ ] 4.2 Confirm `nextActionSuggestion` output and ranking are unchanged by
  running the existing suggestion tests unmodified, then run `npm run check` and
  `openspec validate ts-009 --strict --no-interactive`, reporting the exact
  commands and their output.
- [ ] 4.3 Before sync, verify the delta under
  `openspec/changes/ts-009/specs/next-action-suggestion/spec.md` contains
  only `## MODIFIED Requirements` with the single `Suggestion card content`
  requirement, preserves the original scenario and adds the new explanation
  scenarios. This verification is the implementer's last checklist task.

## Post-sync review (after the workflow sync, outside the apply checklist)

- After the OpenCode OPSX sync, diff
  `openspec/specs/next-action-suggestion/spec.md` against the previous
  canonical revision. Confirm that only `Suggestion card content` changed,
  that all other requirements and scenarios remain identical, and that no
  requirement or scenario was duplicated.
- Verify the sync scope guard, the OpenSpec archive and independent PR CI.
  A reviewer must approve the semantic diff before merge.
- These post-sync assertions cannot be ticked by apply before sync has run.

## Workflow follow-up

- Do not archive during implementation; sync and archive only through the
  project's reviewed process after every tracked task is checked.
- Confirm no protected path (`AGENTS.md`, workflows, `backlog/*`,
  `docs/factory/*`, config, secrets) changed and that independent CI passes
  before human merge.
