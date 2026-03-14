# Tech Stack

Document the canonical runtime, frameworks, infrastructure, and external services used by this project.

## Runtime

- Product form: Web application
- Primary runtime: `TypeScript` on `Next.js`
- Language and runtime versions:
  - `TypeScript` latest stable project baseline
  - `Node.js` version aligned with current `Next.js` LTS support
- Hosting model:
  - `Next.js` application for web UI and application server
  - local development and local operation via `Docker`
- Data stores:
  - `PostgreSQL`

## Libraries And Platforms

- Backend frameworks:
  - `Next.js` server capabilities
- Frontend frameworks:
  - `Next.js`
  - `React`
- UI component library or adopted design system: `TBD`
- Storybook or other UI review tooling: `TBD`
- Observability and batch tooling: `TBD`
- External AI / LLM providers:
  - `OpenAI`
  - `Anthropic`
  - `Azure OpenAI`

## Integration Constraints

- Database and LLM provider integrations must be isolated behind abstract interfaces so implementations can be replaced without rewriting domain logic.
- `PostgreSQL` is the initial persistence choice, not a hard-coded architectural assumption.
- Multi-provider LLM support is required from the start; provider selection must be configurable per environment and extensible over time.

## Product-Level Assumptions

- The application must support AI-driven document refinement from free-form user input.
- The initial intake must combine template-based structured fields with free-form text input.
- The application must support structured task generation from refined documents.
- The application must support multiple project-management views including kanban and gantt.
- The initial MVP must include document editing, project-refinement AI chat, kanban, and gantt.
- AI chat is a project-refinement tool, not a general-purpose assistant surface.
- Final stack choices should optimize for iterative AI workflows, structured document editing, and responsive visual task management.
