# VibeToDo

[日本語版 README](README.ja.md)

> **Turn vague project ideas into actionable plans — with AI.**

VibeToDo is a local-first web app that takes your rough project concepts or daily work descriptions and transforms them into structured, executable plans. You capture the intent; the AI handles the refinement.

---

## Why VibeToDo?

Most planning tools assume you already know what you want to build. VibeToDo starts where you actually are — with a fuzzy idea — and guides you through structured intake, AI-powered refinement, and task synthesis.

```
Your vague idea  →  Structured intake  →  AI refinement  →  Actionable tasks
```

![Intake screen](images/intake.png)

---

## Features

- **Dual planning modes** — Switch between `project` and `daily_work` to match what you're planning
- **Hybrid input** — Combine structured fields (title, objective, scope) with free-form context in a single draft
- **Persistent drafts** — Save anytime and resume later with a `projectId` URL parameter
- **Review before confirming** — Inspect your intake in review state and edit before locking it in
- **Refinement-ready handoff** — Confirming intake initializes a workspace context for downstream AI refinement
- **Pluggable LLM** — Supports OpenAI, Anthropic, and Azure OpenAI via a unified provider adapter

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 + React 19 |
| Language | TypeScript |
| Database | PostgreSQL |
| Testing | Vitest |
| Infrastructure | Docker / Docker Compose |

---

## Quick Start

### 1. Install dependencies

```bash
npm ci
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` to set your database URL and LLM provider:

```env
# Database
DATABASE_URL=postgres://vibetodo:vibetodo@localhost:5432/vibetodo

# LLM Provider — choose one: openai | anthropic | azure_openai
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
```

### 3. Start PostgreSQL

```bash
docker compose up -d db
```

### 4. Initialize the schema

```bash
npm run db:init
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Docker (all-in-one)

Start the app and database together:

```bash
docker compose up --build
```

| Service | Port |
|---------|------|
| App | `3000` |
| PostgreSQL | `5432` |

---

## Testing

```bash
npm test
```

Uses `vitest run`. Integration and E2E helpers are also available:

```bash
npm run test:integration
npm run test:e2e
```

---

## API Reference

### `POST /api/projects`

Save a draft or confirm intake.

| `generationTrigger` | Behavior |
|---------------------|----------|
| `"draft_save"` (or omitted) | Saves as draft |
| `"intake_confirm"` | Confirms intake and initializes refinement session |

**Example — save a draft:**

```json
{
  "generationTrigger": "draft_save",
  "project": {
    "planning_mode": "project",
    "structuredInput": {
      "title": "New onboarding flow",
      "objective": "Reduce setup friction",
      "background_or_current_situation": "Users drop before first success",
      "scope_summary": "Focus on first-run experience",
      "stakeholders": "PM, Design, Support",
      "expected_outcome_or_deliverable": "",
      "constraints_or_conditions": "Keep rollout low-risk"
    },
    "freeFormInput": {
      "body": "Free-form planning context goes here."
    }
  }
}
```

### `GET /api/projects/:projectId/workspace-context`

Returns the workspace context for a saved draft or confirmed project. The right panel of the UI renders this response directly.

---

## UI Behavior Notes

- Draft ID is not assigned until first save
- Append `?projectId=<id>` to auto-resume a session
- Review state is self-contained — no page navigation required
- `allowedActions.canConfirm` reflects current state

---

## Directory Structure

```
app/
  api/projects/          Next.js Route Handlers
  page.tsx               Home screen
src/
  components/
    intake-app.tsx       Intake UI
  lib/intake/            Domain logic, validation, persistence
scripts/
  init-db.ts             DB schema initialization
briefs/                  Requirement briefs
designs/                 Design artifacts
```

---

## Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| SCR-001 | Project intake & draft management | ✅ Implemented |
| SCR-002 | AI-powered spec refinement workbench | ✅ Implemented |
| SCR-003 | Task plan synthesis | ✅ Implemented |
| SCR-004 | Management workspace (kanban / timeline) | ✅ Implemented |

**SCR-002 — Spec Refinement Workbench**
Draft every artifact, edit directly in place, and move through approval without leaving the screen.

![Refinement workbench](images/refinement.png)

**SCR-004 — Management Workspace**
Kanban and Gantt views driven from a single source of truth, linked back to your approved artifacts.

![Kanban view](images/kanban.png)

---

## Caveats

- Authentication is not implemented — this is a local MVP
- Designed for general project and work descriptions, not software-specific only

---

## Documentation

- [Brief: Project Intake](briefs/001-vibetodo-project-intake.md)
- [Brief: Spec Refinement Workbench](briefs/002-vibetodo-spec-refinement-workbench.md)
- [Brief: Task Plan Synthesis](briefs/003-vibetodo-task-plan-synthesis.md)
- [Brief: Management Workspace](briefs/004-vibetodo-management-workspace.md)
- [Design Overview](designs/specific_design/001-vibetodo-project-intake/overview.md)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)

---

*VibeToDo is an MVP. Rough edges are expected and intentional.*
