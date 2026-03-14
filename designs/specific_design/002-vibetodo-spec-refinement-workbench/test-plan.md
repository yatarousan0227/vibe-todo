# Test Plan

## Test Levels
- unit
- integration
- end-to-end

## Scope
- validate canonical artifact sequencing, approval gating, and readiness calculation for both `project` and `daily_work`
- validate context-bound generation requests, immutable snapshot persistence, and approval audit capture
- validate stale propagation into downstream artifacts and the latest task plan snapshot
- validate provider-neutral generation behavior and normalized retryable failure handling
- validate shared screen responsibilities for `SCR-002` and `SCR-003`
- shared_ui_design_refs:
  - CD-UI-001

## Environments
- local browser against Next.js dev or preview server
- integration environment with PostgreSQL and mocked or fixture-backed `RefinementEngine`
- provider contract environment for OpenAI, Anthropic, and Azure OpenAI adapters
- Storybook static build for `SCR-002` and `SCR-003` screen review

## Execution Order
1. unit
2. integration
3. end-to-end

## Execution Notes
- Run unit tests first for artifact sequence rules, readiness gating, stale propagation logic, and provider-neutral error normalization.
- Run integration tests next against PostgreSQL plus the shared API to verify immutable snapshot persistence, diff retrieval, approval audit, and stale task plan updates.
- Run provider contract tests before end-to-end release signoff so OpenAI, Anthropic, and Azure OpenAI adapters all satisfy the same `RefinementEngine` behavior.
- Run end-to-end tests through `SCR-001` intake handoff, `SCR-002` refinement, `SCR-003` approval, and `SCR-004` readiness unlock to confirm cross-domain sequencing with briefs `001`, `003`, and `004`.
- Include at least one non-software planning scenario in integration and end-to-end suites to satisfy the project coding rules.

## Ownership
- feature implementation owner for DOM-002
- reviewer covering DOM-001 intake handoff sufficiency
- reviewer covering DOM-003 task synthesis readiness and stale semantics
- reviewer covering DOM-004 workspace stale and feedback-return integration
