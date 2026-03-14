# UI Storybook

This directory is the feature-level Storybook design bundle for `004-vibetodo-management-workspace`.

## Purpose

- review `SCR-005 Management Workspace` states against the brief requirements
- keep kanban, gantt, stale read-only, and empty-plan screens aligned with `ui-fields.yaml`
- show how execution feedback returns to refinement without inventing a separate workspace record

## Included Review States

- current published plan with kanban as the active view
- gantt-focused review with editable task detail visible
- stale read-only workspace with refinement return path
- no-published-plan empty state that routes back to `SCR-004`

## Structure

- `package.json`: pinned Storybook runtime and build scripts
- `.storybook/main.ts`: Storybook HTML Vite configuration
- `.storybook/preview.ts`: shared preview parameters
- `.storybook/preview.css`: workspace-specific visual language and layout tokens
- `stories/SCR-001-example.stories.js`: `SCR-005` review states
- `components/SCR-001-example.html`: shared HTML shell for story token replacement

## Local Review

```bash
npm install
npm run storybook
```

To verify the bundle before handoff:

```bash
npm run build-storybook
```

## Rules

- stories remain design artifacts and must mirror `ui-fields.yaml`
- kanban and gantt are alternate views inside one `SCR-005` shell
- stale and empty states must stay distinct from the editable current-plan state
- any future management view should extend this shell rather than replace the canonical task contract
