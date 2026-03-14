# Sequence Flow: Core Flow

- sequence_id: SEQ-001
- requirement_ids:
  - REQ-001
  - REQ-002
  - REQ-003
  - REQ-004
  - REQ-005
  - REQ-006
  - REQ-007

```mermaid
sequenceDiagram
    participant User
    participant SCR002 as SCR-002 UI
    participant API as Project Planning API
    participant Module as Planning Application Module
    participant Engine as RefinementEngine
    participant Provider as LLM Provider Adapter
    participant DB as PostgreSQL
    participant SCR003 as SCR-003 UI

    User->>SCR002: Open active project and choose artifact_key
    SCR002->>API: GET /api/projects/{projectId}/workspace-context
    API->>Module: ReturnProjectWorkspaceContext(projectId)
    Module->>DB: Load RefinementSession, approved upstream snapshots, readiness, stale state
    DB-->>Module: Workspace context for current project_id
    Module-->>API: artifactSummaries, allowedActions, staleDependencies
    API-->>SCR002: Render sequence rail and context-bounded drafting surface
    User->>SCR002: Enter refinement prompt or explicit edit and trigger generate/regenerate
    SCR002->>API: POST /api/projects/{projectId}/artifacts/{artifactKey}/generations
    API->>Module: GenerateArtifactDraft(projectId, artifactKey, trigger)
    Module->>DB: Create generation job and freeze current approved baseline
    Module->>Engine: Build prompt from active artifact plus approved upstream snapshots only
    Engine->>Provider: Request artifact draft through replaceable provider port
    Provider-->>Engine: Draft content and structured rationale
    Engine-->>Module: Candidate snapshot content and change reason
    Module->>DB: Persist immutable ArtifactSnapshot, diff metadata, and job completion
    DB-->>Module: current snapshot, previous snapshot, stale impact summary
    Module-->>API: job status timeline, current draft metadata, stale dependencies
    API-->>SCR002: Show current draft, change reason, and approval CTA
    User->>SCR002: Open SCR-003 review boundary
    SCR002-->>SCR003: Navigate with artifactSnapshotId
    SCR003->>API: GET /api/projects/{projectId}/workspace-context + diff query
    API->>Module: Load approval evidence for selected snapshot
    Module->>DB: Fetch current snapshot, previous snapshot, audit history, stale impact
    DB-->>Module: Diff, audit metadata, readiness gate
    Module-->>API: Approval review payload
    API-->>SCR003: Render diff, change reason, and downstream stale impact
    User->>SCR003: Approve or reject with explicit decision reason
    SCR003->>API: POST /api/projects/{projectId}/artifacts/{artifactKey}/approvals
    API->>Module: ApproveOrRejectArtifact(projectId, artifactKey, artifactSnapshotId, decision)
    Module->>DB: Record approval audit and propagate stale markers to downstream artifacts and task plan
    DB-->>Module: Updated artifact status and readiness state
    Module-->>API: Next artifact gate or SCR-004 handoff eligibility
    API-->>SCR003: Updated readiness summary
    SCR003-->>User: Return to SCR-002 or unlock SCR-004 when all required artifacts are approved and current
```

## Sequence Notes
- `SCR-002` owns artifact drafting, explicit edit intent, upstream context visibility, and async generation status, but it never approves snapshots.
- The generation prompt is built from the active `project_id`, the active `artifact_key`, and approved current upstream artifacts only; generic chat requests are rejected or redirected.
- `SCR-003` is the only screen that records approve or reject decisions, and each decision is attached to one immutable `artifactSnapshotId`.
- Stale propagation is part of the same approval and current-snapshot update path so `003-vibetodo-task-plan-synthesis` and `004-vibetodo-management-workspace` can trust the freshness signal.
- Cross-domain review with `001-vibetodo-project-intake` should verify that the confirmed intake snapshot is rich enough for the first artifact; review with `003` and `004` should verify that readiness and stale semantics are consumed without reinterpretation.
