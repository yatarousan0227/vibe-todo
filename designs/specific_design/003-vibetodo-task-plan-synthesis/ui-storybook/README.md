# UI Storybook

This directory is the UI design source of truth for the `003-vibetodo-task-plan-synthesis` feature bundle.

## Purpose

- Define reviewable `SCR-004` states with `@storybook/html`
- Keep synthesis, publish, and stale-recovery states aligned with `ui-fields.yaml`
- Make eligibility gating, canonical task review, and workspace handoff visible before implementation

## Structure

- `package.json`: pinned Storybook runtime and scripts
- `.storybook/main.ts`: Storybook configuration for HTML + Vite
- `.storybook/preview.ts`: shared review parameters
- `.storybook/preview.css`: bundle-specific visual review styles
- `stories/`: story definitions for task synthesis and publish states
- `components/`: HTML templates consumed by stories

## Stories

- `Screens/DOM-003 Task Synthesis States/Eligibility Blocked`
- `Screens/DOM-003 Task Synthesis States/Review And Publish`
- `Screens/DOM-003 Task Synthesis States/Stale Published Plan`

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

- Stories remain design artifacts and must not imply automatic publish or hidden task mutation rules
- Canonical task fields, publish blockers, and related artifact links must stay synchronized with `ui-fields.yaml`
- Eligibility gating and stale read-only behavior must remain visible in Storybook because both are cross-domain review points for briefs `002` and `004`
