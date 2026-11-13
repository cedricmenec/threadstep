# Proposal

## Why

The inline action editor blends into a dense task list, making the active edit area harder to distinguish from neighboring rows. A small, token-based surface treatment will make the editing state easier to scan without changing any product behavior.

## What Changes

- Give the existing inline task editor a softly tinted surface, subtle border, rounded corners and internal spacing.
- Keep all editor fields, commands, values, validation and interaction behavior unchanged.
- Keep the form contained and readable at narrow viewport widths.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `action-editing`: specify the visual separation and narrow-viewport presentation of the existing inline editor.

## Impact

- Affected code: `site/styles.css`; no React or controller changes are expected.
- Affected tests: add a deterministic test for the form's localized CSS treatment and responsive containment.
- No data, storage, routes, dependencies, shared form styles or security behavior changes.
- Focus, scroll and in-progress editor values remain governed by the existing action-editing and UX continuity contracts.
