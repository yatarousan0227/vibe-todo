# Test Plan

## Test Levels
- unit
- integration
- end-to-end

## Scope
- validate required-artifact eligibility, missing/stale artifact reporting, and synthesis gating
- validate candidate snapshot generation, immutable snapshot persistence, and task diff history
- validate canonical task shape completeness, placeholder review policy, and publish blocker reporting
- validate traceability preservation across task corrections and publish
- validate stale published-plan handling and `SCR-004` to `SCR-005` handoff semantics
- validate provider-neutral planning behavior and retryable synthesis failure handling
- shared_ui_design_refs:
  - CD-UI-001

## Environments
- local browser against Next.js dev or preview server
- integration environment with PostgreSQL and fixture-backed or mocked `TaskSynthesisEngine`
- provider contract environment for OpenAI, Anthropic, and Azure OpenAI planning adapters
- Storybook static build for `SCR-004` review states and publish/stale walkthroughs

## Execution Order
1. unit
2. integration
3. end-to-end

## Execution Notes
- Run unit tests first for eligibility rules, publish blocker calculation, dependency validation, placeholder generation policy, and stale-state transitions.
- Run integration tests next against PostgreSQL plus the shared API to verify immutable `TaskPlanSnapshot` persistence, `TaskArtifactLink` preservation, and explicit publish behavior.
- Run provider contract tests before end-to-end signoff so OpenAI, Anthropic, and Azure OpenAI adapters all satisfy the same task-planning port contract without UI or module changes.
- Run end-to-end tests through `SCR-003` approval readiness, `SCR-004` synthesis and publish, and `SCR-005` workspace handoff to confirm cross-domain sequencing with briefs `002` and `004`.
- Include at least one non-software planning scenario in integration and end-to-end suites to satisfy the project coding rules and ensure the task model is not software-only.
- Verify that a stale published plan becomes read-only in both `SCR-004` and `SCR-005`, and that regeneration plus republish is the only recovery path back to an editable workspace.
- Verify `npm run build-storybook` for this bundle before handoff so design review states remain runnable.

## Ownership
- feature implementation owner for DOM-003
- reviewer covering DOM-002 artifact readiness and stale-source semantics
- reviewer covering DOM-004 published-only workspace consumption and read-only stale handling
- QA or author running local Docker and Storybook verification before acceptance
