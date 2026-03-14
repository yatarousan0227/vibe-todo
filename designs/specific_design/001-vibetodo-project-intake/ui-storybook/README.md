# UI Storybook

This directory is the UI design source of truth for the `001-vibetodo-project-intake` feature bundle.

## Purpose

- Define reviewable `SCR-001` states with `@storybook/html`
- Keep intake screen states aligned with `ui-fields.yaml`
- Make draft, resume, and pre-start review behaviors visible before implementation

## Structure

- `package.json`: pinned Storybook runtime and scripts
- `.storybook/main.ts`: Storybook configuration for HTML + Vite
- `.storybook/preview.ts`: shared review parameters
- `.storybook/preview.css`: bundle-specific visual review styles
- `stories/`: story definitions for intake states
- `components/`: HTML templates consumed by stories

## Stories

- `Screens/SCR-001 Intake Start/Project Draft`
- `Screens/SCR-001 Intake Start/Daily Work Draft`
- `Screens/SCR-001 Intake Start/Review Before Start`

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

- Stories remain design artifacts and must not hide missing workflow details behind implementation assumptions
- Mode-specific required fields must stay synchronized with `ui-fields.yaml`
- Review state must keep both structured and free-form context visible before the `SCR-002` transition
