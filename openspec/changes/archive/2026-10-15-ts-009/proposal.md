# Proposal

## Why

When the deterministic « Une étape pour maintenant » suggestion appears, the user
cannot tell why that action was chosen without memorizing the ranking rules. A
one-sentence French explanation makes the deterministic choice understandable and
trustworthy (FR-14) while keeping the feature offline, local and view-only.

## What Changes

- Add a short French explanation to the **existing** suggestion card: it names
  the suggested action's effective priority (urgent, normal, plus tard) and
  states the existing tie-break rule (subject order, then action order).
- Derive the explanation from a small pure, deterministic helper so it can be
  unit-tested without a DOM.
- Render the explanation as a text node inside the existing non-modal card, only
  when a valid suggestion exists; the empty state stays unchanged and shows no
  misleading explanation.
- Change nothing in the selection logic (TS-007), the tracking feature (TS-008),
  the document schema, storage keys, JSON export/import or persistence. No AI,
  network request or new dependency.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `next-action-suggestion`: the canonical requirement « Suggestion card content »
  is extended so the card also shows a French explanation of why the action was
  selected. Every other requirement and scenario of the capability stays
  unchanged, and the existing « Card shows the suggested action » scenario is
  preserved.

## Impact

- `site/core.js`: new pure helper formatting the explanation from a priority.
- `site/app.js`: render the explanation inside the existing suggestion card.
- `site/styles.css`: minor style for the explanation.
- `tests/core.test.mjs`: unit tests for the three priorities, an invalid value
  and determinism.
- `docs/product/mvp.md`: mark FR-14 implemented and align its acceptance test.
- Unchanged: selection algorithm, resume tracking, schema/version,
  `threadstep.document.v1` and `threadstep.resume.v1` keys, JSON
  export/import, GitHub Pages URLs, dependencies, workflows and factory policy.

## Non-Goals

- Changing how the suggested action is selected or excluding candidates.
- Adding a second suggestion, a new mandatory control, AI/network calls,
  persistence or history.
- Touching TS-008 tracking or linking the explanation to it.
- Changing the document schema/version, storage keys, JSON shape or exports.

## Unresolved Decisions / Uncertainties

- **Exact French wording.** The backlog example covers only the urgent case. The
  plan uses one fixed sentence per priority built from the French label
  (« Urgent », « Normal », « Plus tard ») and appends the tie-break clause
  « en cas d'égalité, l'ordre des sujets puis des actions décide ». This is a
  wording assumption open to review; it invents no new ranking criterion.
- **Tie-break clause always vs only on a tie.** The plan shows it always, matching
  the backlog's example and keeping the helper trivial. It is phrased as a
  general rule, so it stays true when no tie occurs. A conditional variant is a
  possible review alternative but is not required by the acceptance criteria.
- Typography details (guillemets, spacing before `;`) are minor and not product
  decisions.
