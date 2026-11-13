# Design

## Context

The current Overview filter is a fieldset with four radio labels. On narrow dashboard widths the options stack vertically. The filter state and filtering rules already live in the Overview controller and are transient. See `proposal.md` and the `overview-urgency-filter` and `ux-interaction-continuity` specifications.

## Goals / Non-Goals

**Goals:** reduce the filter's vertical footprint while preserving its accessible name, selected value, keyboard and touch use, and existing filtering behavior.

**Non-Goals:** change filter semantics, persistence, routing, project cards or other filters.

## Decisions

- Use one native `<select>` with the existing four mode values and visible label. A custom popover would need additional focus, dismissal and touch behavior without adding value for four fixed choices; the native control provides those platform behaviors.
- Keep `overviewProjectFilter` as the source of truth and adapt its existing synchronization and focus fallback to the single control. Selection continues to rerender the project list only; the control remains mounted, so its focus, selected value and viewport context are preserved.
- Style the label/select as a compact responsive row using existing design tokens, with a minimum 44 px control target and a visible keyboard focus indicator.

## Risks / Trade-offs

- Native select rendering varies slightly by browser and operating system → retain clear labels, sufficient target size and a simple appearance; include real-browser mobile and keyboard checks in Manual acceptance.
- Long option text may be clipped at very narrow widths → allow the control to shrink within its container and verify no horizontal overflow.

## Migration Plan

No data migration is needed because the filter remains transient. Deploy the updated static site; rollback by reverting the UI PR.

## Open Questions

None.
