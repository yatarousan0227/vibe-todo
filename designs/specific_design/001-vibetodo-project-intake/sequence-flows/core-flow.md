# Sequence Flow: Core Flow

- sequence_id: SEQ-001
- requirement_ids:
  - REQ-001
  - REQ-003
  - REQ-004
  - REQ-005
  - REQ-006

```mermaid
sequenceDiagram
    participant User
    participant SCR001 as SCR-001 UI
    participant API as Project Planning API
    participant Module as Planning Application Module
    participant DB as PostgreSQL

    User->>SCR001: Enter planning mode, structured fields, and free-form context
    SCR001->>API: POST /api/projects (draft save with projectId optional)
    API->>Module: SaveProjectDraft
    Module->>DB: Upsert Project draft and intake draft payload
    DB-->>Module: project_id and current draft state
    Module-->>API: draft_intake lifecycle response
    API-->>SCR001: Render resumable draft and review-ready state
    User->>SCR001: Review full structured + free-form intake and confirm
    SCR001->>API: POST /api/projects (confirm intake)
    API->>Module: InitializeProjectFromIntake
    Module->>DB: Persist confirmed intake snapshot and active RefinementSession
    DB-->>Module: confirmed project context and session state
    Module-->>API: refinement-ready workspace context
    API-->>SCR001: project_id, confirmed_at, active_artifact_key
    SCR001-->>User: Route to SCR-002 Refinement Loop
```

## Sequence Notes
- `SCR-001` is responsible for capture, draft persistence triggers, review display, and transition intent only.
- The API call stays anchored on `project_id` so resumed drafts do not fork into duplicate projects.
- Review confirmation must persist structured input, free-form input, `planning_mode`, and `confirmed_at` in the same project context write.
- The handoff to `SCR-002` is blocked until the module confirms one active `RefinementSession` with `active_artifact_key=objective_and_outcome`.
- Local Docker deployment readiness affects this flow because the Next.js application and PostgreSQL must both be available for save, resume, and confirm operations.
