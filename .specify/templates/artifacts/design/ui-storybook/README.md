# UI Storybook

This directory is the UI design source of truth for Storybook HTML.

## Purpose

- Define reviewable UI states with `@storybook/html`
- Keep screen variants and HTML templates together
- Link UI states back to requirements and field definitions

## Structure

- `package.json`: pinned Storybook runtime and scripts
- `.storybook/main.ts`: Storybook configuration
- `.storybook/preview.ts`: shared preview parameters
- `.storybook/preview.css`: global review styles
- `stories/`: story definitions
- `components/`: HTML templates used by stories

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

- Stories are design artifacts, not production runtime code
- Keep stories aligned with `ui-fields.yaml`
- Add one story per meaningful screen or UI state
- Keep the bundle buildable without adding app-specific tooling first
