# Test Plan

## Test Levels
- unit
- integration
- end-to-end

## Scope
- validate `SCR-001` mode switching, mixed input validation, and review-state gating
- validate draft save and resume persistence against PostgreSQL with `project_id` continuity
- validate atomic confirmation of intake snapshot plus active `RefinementSession`
- validate local Docker accessibility without authentication
- shared_ui_design_refs:
  - CD-UI-001

## Environments
- local browser against Next.js dev or preview server
- Docker-based integration environment with PostgreSQL
- Storybook static build for screen review and requirement walkthrough

## Execution Order
1. unit
2. integration
3. end-to-end

## Execution Notes
- Run unit tests first for mode-specific validation, review gating, and lifecycle mapping utilities.
- Run integration tests next against PostgreSQL and the project planning API to verify `draft_intake` save, resume, and confirm semantics.
- Run end-to-end tests last through `SCR-001` to `SCR-002` handoff, including the review state and local Docker deployment path.
- Include cross-domain review with `002-vibetodo-spec-refinement-workbench` to ensure confirmed intake context is sufficient for the first refinement step.
- Use at least one non-software scenario in unit and end-to-end suites to satisfy project coding rules.

## Ownership
- feature implementation owner for DOM-001
- reviewer covering DOM-002 intake-to-refinement handoff
- QA or author running local Docker verification before acceptance
