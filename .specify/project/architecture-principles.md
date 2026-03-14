# Architecture Principles

This file is the shared source of architectural truth for all design bundles in the repository.

## Required Principles

### Responsibility Boundaries

- The intake layer owns raw user input, project metadata, and initialization of a refinement session.
- The spec refinement layer owns AI-driven question generation, document drafting, document revision, and approval state for general work and project planning, not only software delivery.
- The task planning layer owns conversion from approved artifacts into executable tasks, dependencies, and schedule-ready structures.
- The management workspace owns visualization and interaction patterns such as kanban boards, gantt charts, and other project-management tools.
- Conversational UI is allowed only when it advances project or work refinement; it must not behave as a general-purpose chatbot surface.
- UI screens must not embed refinement or planning rules directly; they orchestrate application services and render state.

### Intake Model

- The initial MVP intake experience must combine structured template fields with free-form text input.
- Template fields should capture the minimum planning scaffolding without forcing users into software-specific terminology.
- Free-form text remains the primary source for nuance, intent, and context that does not fit the template shape.
- Refinement services should treat structured fields and free-form narrative as first-class inputs when generating the first artifact draft.

### Canonical Artifact Set

- The system should refine user input toward a standard artifact set suitable for work and project management beyond software development.
- The default required artifact set is:
  - `Objective and Outcome`: what the user is trying to achieve and what success looks like
  - `Background and Current Situation`: why this work exists now and what context already exists
  - `Scope and Non-Scope`: what is included and explicitly excluded
  - `Constraints and Conditions`: time, budget, policy, staffing, approval, or operational limits
  - `Stakeholders and Roles`: who is involved, affected, or responsible
  - `Deliverables and Milestones`: what must be produced and by when
  - `Work Breakdown`: major workstreams or phases before task-level expansion
  - `Risks, Assumptions, and Open Questions`: unresolved items that affect planning quality
  - `Task Plan`: prioritized executable tasks with dependency-ready structure
- Tasks should only be generated after the upstream artifacts are sufficiently refined for the requested planning depth.

### Canonical Task Shape

- Every generated task must include the following minimum fields:
  - `Title`
  - `Description`
  - `Priority`
  - `Status`
  - `Due Date`
  - `Dependencies`
  - `Estimate`
  - `Assignee`
  - `Related Artifacts`
- These fields define the source of truth for task management views such as kanban and gantt.
- Optional task fields may be added by domain-specific workflows, but the minimum set must remain stable across projects.

### Approval And Refinement Flow

- Refinement proceeds artifact by artifact rather than as one opaque generation batch.
- The system must request explicit user approval at each document boundary before advancing to the next artifact.
- Users must be able to edit AI-generated content before approving that artifact.
- Task generation is blocked until the required upstream artifacts have been individually approved.
- When users reject or revise an artifact, downstream artifacts and tasks derived from it must be marked stale until regenerated or re-approved.

### Dependency Direction

- UI depends on application services.
- Application services depend on domain policies and ports.
- Infrastructure adapters, including LLM providers and persistence, depend on domain-defined interfaces rather than the reverse.
- Database and AI provider integrations must be accessed only through explicit ports or interfaces so they remain replaceable.
- Management views must read from canonical project, artifact, and task models instead of maintaining parallel planning logic.

### API And Batch Ownership Rules

- All document generation and refinement operations are owned by the spec refinement application service.
- Task generation is allowed only from user-confirmed or system-approved artifact snapshots.
- Long-running AI operations should run asynchronously and expose progress, intermediate state, and retry behavior to the user.
- External LLM integrations must be isolated behind replaceable provider adapters so model vendors can change without rewriting core workflows.
- AI chat endpoints and prompts must be constrained to artifact clarification, refinement, and task-planning support tied to the active project context.

### Data Consistency And Integration Principles

- Every generated task must keep a traceable link to the artifact or decision that produced it.
- User edits are first-class data and must not be silently overwritten by later AI generations.
- Artifact versions, approval state, and task-generation snapshots must be preserved for auditability and rollback.
- Cross-view representations such as kanban and gantt must derive from the same underlying task source of truth.
- PostgreSQL is the initial persistence layer, but repository contracts must remain provider-neutral so another store can replace it with bounded implementation changes.
- The initial product experience assumes local use without authentication or multi-user ownership constraints.
- The artifact model must remain generic enough to support business operations, personal work planning, event planning, research, and other non-software projects without introducing software-specific required fields.
