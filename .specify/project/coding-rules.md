# Coding Rules

Document the implementation rules that generated tasks must respect.

## Required Rules

### Naming Conventions

- Use stable domain terms consistently across code and documents: `Project`, `RefinementSession`, `Artifact`, `Task`, `Board`, and `Timeline`.
- Name modules by durable business capability rather than by screen-specific wording.
- Keep AI provider details out of domain names; use abstract names such as `LLMProvider` or `RefinementEngine`.
- Keep external service implementations clearly separated from abstractions, for example `TaskRepository` vs `PostgresTaskRepository`.
- Avoid software-delivery-specific names such as `FeatureSpec` or `EngineeringTask` in shared core models unless they are truly limited to a software-only subdomain.
- Use the canonical task field names consistently in APIs, persistence contracts, and UI mapping layers, even if labels shown to users are localized.

### Error Handling Expectations

- AI generation failures must return actionable user-facing messages with retry paths.
- Validation errors must clearly distinguish user input issues from system or provider failures.
- No workflow may silently discard user edits, generated artifacts, or task structures.
- External integration failures from PostgreSQL, OpenAI, Anthropic, or Azure OpenAI must be normalized into application-level error categories.
- If a user attempts to use chat outside the refinement workflow, the system must redirect them back to supported refinement actions instead of pretending to support general chat.
- The system must not auto-approve, auto-promote, or silently finalize artifacts across document boundaries.

### Logging And Monitoring Rules

- Log refinement runs with model identifier, latency, token usage when available, and success or failure outcome.
- Preserve auditability for document generation, user edits, approvals, and task-generation events.
- Do not log sensitive user project content beyond what is necessary for debugging and operations.
- Database and external API logs must avoid storing secrets, connection strings, and personally sensitive payloads.

### Review And Testing Expectations

- Domain logic for refinement, approval, and task generation requires automated tests.
- AI-dependent flows should be tested with deterministic fixtures or mocks at the integration boundary.
- Core user journeys must be covered end-to-end: project intake, document refinement, task generation, and task management views.
- Any change that can affect generated task correctness must include a review of traceability from artifacts to tasks.
- Adapters for PostgreSQL and each LLM provider must be covered by contract-oriented tests so replacements can be validated against the same interface behavior.
- Conversational flows must be tested to ensure prompts, UI affordances, and server actions stay within the project-refinement scope.
- Tests and reviews for artifact generation should cover at least one non-software scenario so the platform does not regress into a software-only planner.
- Task-generation tests must verify that all minimum task fields are populated and remain traceable to their source artifacts.
- Approval-flow tests must verify that each artifact requires explicit approval and that downstream outputs become stale when an approved upstream artifact changes.
- Intake-flow tests must verify that template fields and free-form text are both preserved and reflected in the first refinement output.
