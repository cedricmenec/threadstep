# Design

## Context

See `proposal.md` — Why. The suggestion already exists:
`nextActionSuggestion(document)` in `site/core.js:50` owns the deterministic
ranking `(priorityIndex, subjectIndex, itemIndex)`, and `renderSuggestion()` in
`site/app.js:109` renders `#focus-card` (`focus-label`, `focus-title`,
`focus-meta`, `focus-actions`) into the `aria-live` region declared at
`site/index.html:38`. Pure helpers in `core.js` are unit-tested by
`tests/core.test.mjs` with `node --test`, and `PRIORITIES` is the canonical enum
`["urgent","normal","later"]`. The card already builds every node with the
`el()` helper and `textContent`, so user text such as `<img …>` is shown
literally. There is no schema, storage-key or export change to make.

## Goals / Non-Goals

**Goals:**

- Explain the deterministic choice with one short French sentence shown on the
  existing card.
- Keep the explanation deterministic, testable without a DOM, and derived only
  from the effective priority.
- Preserve every existing requirement, scenario and interaction of the
  capability.

**Non-Goals:**

- Changing the ranking, eligibility, tie-break or the card's other content.
- Persisting or restoring the explanation, or coupling it to TS-008 tracking.
- New dependencies, storage keys or schema changes.

## Decisions

1. **Pure formatter `suggestionReason(priority)` in `site/core.js`.** It returns
   the fixed French sentence for `urgent`, `normal` or `later`, and `null` for
   any other value, and never mutates anything. It takes only the priority, so
   it cannot invent criteria and is trivially deterministic. Rationale: mirrors
   the pure, DOM-free helpers already tested by `tests/core.test.mjs`.
   Alternative rejected: deriving the text inside `app.js` (untestable without a
   DOM).

2. **Reason content.** One sentence naming the effective priority plus the
   existing tie-break rule:
   - urgent → `Choisie selon sa priorité « Urgent » ; en cas d'égalité, l'ordre des sujets puis des actions décide.`
   - normal → same sentence with « Normal »
   - later → same sentence with « Plus tard »

   The label is quoted so « Plus tard » reads grammatically without inventing an
   adjective. The tie-break clause mirrors the selection key exactly: earlier
   subject order, then earlier item order. It is stated as a general rule and is
   therefore true whether or not a tie actually occurred. Alternative rejected:
   branching on whether a real tie exists — it needs a second scan and does not
   change observable truth.

3. **Render inside the existing card.** `renderSuggestion()` appends the reason
   as a `<p class="focus-reason">` text node between `focus-meta` and the
   actions, only in the valid-suggestion branch. The empty-state branch is
   untouched, so no explanation is shown when there is no suggestion. The reason
   carries no user data, so the existing safe-text guarantee is unaffected.
   Rationale: smallest change; no new control, no second result.

4. **No selection or persistence change.** `nextActionSuggestion` is not
   modified; `app.js` keeps recomputing on activation and never calls
   `persist()` because of the reason. Rationale: the change must be view-only and
   must not disturb TS-007 or TS-008.

## Risks / Trade-offs

- **Wording review risk** (the exact French phrase) → Mitigation: keep the phrase
  in one pure helper with its own unit tests, so rewording is a one-line change
  plus a test update; the wording is flagged as an assumption in `proposal.md`.
- **Always including the tie-break clause may look redundant when no tie exists**
  → Accepted: it is a true conditional rule matching the existing ordering and
  the backlog example, and it avoids extra tie-detection logic.
- **The card rerenders on any state change** → Mitigation: the reason is derived
  from the freshly computed suggestion each time, so it can never go stale.

## Migration Plan

None. No schema, version, storage key or export change. Rollback is removing the
helper call and the paragraph; stored documents and exports stay valid.

## Open Questions

None that change the specs or approach. The wording and tie-clause choices are
recorded as assumptions in `proposal.md` and are safe to confirm during review.
