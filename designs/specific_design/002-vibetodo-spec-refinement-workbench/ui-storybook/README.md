# UI Storybook

This directory is the UI design source of truth for the `002-vibetodo-spec-refinement-workbench` feature bundle.

## Purpose

- Define reviewable `SCR-002` and `SCR-003` states with `@storybook/html`
- Keep refinement and approval states aligned with `ui-fields.yaml`
- Make async generation, approval gating, and stale impact visible before implementation

## Structure

- `package.json`: pinned Storybook runtime and scripts
- `.storybook/main.ts`: Storybook configuration for HTML + Vite
- `.storybook/preview.ts`: shared review parameters
- `.storybook/preview.css`: bundle-specific visual review styles
- `stories/`: story definitions for refinement and approval states
- `components/`: HTML templates consumed by stories

## Stories

- `Screens/DOM-002 Refinement Review States/Refinement Loop Active Draft`
- `Screens/DOM-002 Refinement Review States/Approval Boundary`
- `Screens/DOM-002 Refinement Review States/Stale Downstream Impact`

## Local Review

```bash
npm install
npm run storybook
```

To verify the bundle in CI or before handoff:

```bash
npm run build-storybook
```

## Rules

- Stories remain design artifacts and must not imply auto-approval or implicit document updates
- Async job states, change reasons, and stale downstream messaging must stay synchronized with `ui-fields.yaml`
- `SCR-002` and `SCR-003` responsibilities must remain distinct even when they are reviewed in one Storybook file
