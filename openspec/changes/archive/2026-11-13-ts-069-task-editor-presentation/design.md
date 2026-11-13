# Design

## Context

See `proposal.md` for the motivation and `specs/action-editing/spec.md` for the observable contract. The existing `.task-edit-form` rule is used by the inline action editor across the app's current render paths and already wraps its contents on narrow screens.

## Goals / Non-Goals

**Goals:** Make the active editor read as one contained surface while retaining the existing layout and control behavior.

**Non-Goals:** Change editor markup, task cards, project cards, shared button styles, validation, field order, focus management or persistence.

## Decisions

- Add the presentation to the existing `.task-edit-form` rule in `site/styles.css`. This keeps both existing render paths visually consistent without adding wrapper markup or changing their ownership.
- Use the existing `--color-surface-muted`, `--color-border-subtle`, `--radius-panel` and spacing tokens. Reusing the local token system keeps the new surface consistent with the delivered UI.
- Keep `flex-wrap`, `max-width` and `min-width` behavior, and add `box-sizing: border-box` so the border and padding remain inside the available width. The alternative of adding a new breakpoint or resizing child controls is unnecessary for this localized treatment.

## Risks / Trade-offs

- The panel adds a small amount of height while editing, which may move nearby content. Keep the padding modest and retain the current scroll/focus behavior; no rerender or state change is introduced.
- A style regression could affect either render path. Cover the shared selector and its containment rules with a deterministic test.

## Migration Plan

No data or configuration migration is needed. Roll back by reverting the `.task-edit-form` presentation declarations and its focused test.

## Open Questions

None.
