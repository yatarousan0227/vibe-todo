# Test Plan

## Test Levels
- unit
- integration
- end-to-end

## Scope
- validate shared source-of-truth hydration for kanban, gantt, task detail, artifact health, stale state, and empty state
- validate canonical task patch rules, required-field preservation, dependency validation, and related artifact retention
- validate stale read-only gating and refinement feedback handoff back to `SCR-002`
- validate local Docker accessibility with Next.js and PostgreSQL and no authentication barrier
- shared_ui_design_refs:
  - CD-UI-001

## Environments
- local browser against Next.js dev or preview server
- Docker-based integration environment with PostgreSQL
- integration environment seeded with published, stale, and empty task-plan fixtures
- Storybook static build for `SCR-005` review states

## Execution Order
1. unit
2. integration
3. end-to-end

## Execution Notes
- Run unit tests first for workspace-context mapping, freshness gating, task patch validation, and feedback-handoff payload construction.
- Run integration tests next against PostgreSQL and the shared API to verify current-plan hydration, read-only stale behavior, canonical task patch persistence, and empty-plan branching.
- Run end-to-end tests last through `SCR-004` publish into `SCR-005`, then through kanban edit, gantt inspection, stale read-only fallback, and `SCR-005 -> SCR-002` feedback return.
- Include cross-domain review with `003-vibetodo-task-plan-synthesis` to confirm only published task plans appear in the workspace and with `002-vibetodo-spec-refinement-workbench` to confirm feedback handoff context is sufficient for targeted re-refinement.
- Use at least one non-software planning example so task-management screens and gantt semantics are validated outside software-delivery assumptions.

## Ownership
- feature implementation owner for DOM-004
- reviewer covering DOM-003 publish boundary and stale handoff semantics
- reviewer covering DOM-002 feedback-return context and stale reason wording
- QA or author running Docker and Storybook verification before acceptance
