# Proposal

## Why

The four choices in Overview's « Filtrer les projets » control consume too much vertical space, especially on mobile. A compact selection control will make the active mode clear while leaving more room for the project list.

## What Changes

- Replace the four-option radio group with a compact, labelled selection control.
- Preserve the four filter modes, their existing results, and the transient state behavior.
- Keep the filter independent from « Masquer les étapes terminées ».

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `overview-urgency-filter`: require a compact, accessible selection control while preserving filter behavior and view continuity.

## Impact

Update Overview filter markup, event binding and presentation styles, plus the related UI tests. No data model, storage, network, route or dependency changes.
