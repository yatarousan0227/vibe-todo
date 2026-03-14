# Sequence Flow: Core Flow

- sequence_id: SEQ-001
- requirement_ids:
  - REQ-001
  - REQ-002
  - REQ-003
  - REQ-004
  - REQ-005
  - REQ-007

```mermaid
sequenceDiagram
    participant User
    participant SCR005 as SCR-005 UI
    participant API as Project Planning API
    participant Module as Planning Application Module
    participant DB as PostgreSQL
    participant SCR002 as SCR-002 UI

    User->>SCR005: Open management workspace for current project
    SCR005->>API: GET /api/projects/{projectId}/workspace-context
    API->>Module: ReturnProjectWorkspaceContext(projectId)
    Module->>DB: Load current published TaskPlanSnapshot, Task records, artifact health, and allowed actions
    DB-->>Module: task plan summary, tasks, stale dependencies, execution-order metadata
    Module-->>API: workspace context for SCR-005
    API-->>SCR005: Render kanban, gantt, task detail affordances, and artifact health
    User->>SCR005: Open task detail and edit allowed canonical fields
    SCR005->>API: PATCH /api/projects/{projectId}/tasks/{taskId}
    API->>Module: UpdateTask(projectId, taskId, taskPatch, clientRevision)
    Module->>Module: Validate freshness_status=current and preserve related artifact links
    Module->>DB: Persist canonical Task update
    DB-->>Module: updated Task and task plan summary
    Module-->>API: synchronized task mutation result
    API-->>SCR005: Refresh board counts, gantt markers, detail drawer, and artifact references
    alt Task plan becomes stale upstream
        API-->>SCR005: allowedActions mutate=false with stale reason
        SCR005-->>User: Switch workspace to read-only and show regeneration path
    end
    opt User sends execution feedback to refinement
        User->>SCR005: Select related artifact and enter feedback note
        SCR005->>SCR002: Navigate with project_id, task_id, artifact_snapshot_id, feedback note
        SCR002->>API: GET /api/projects/{projectId}/workspace-context
        API-->>SCR002: refinement-ready project context
        SCR002-->>User: Resume refinement with handoff context applied
    end
```

## Sequence Notes
- `SCR-005` owns visual orchestration only; it does not calculate a second task plan or persist execution feedback as an independent record.
- `GET /api/projects/{projectId}/workspace-context` is the common hydration path for kanban, gantt, artifact health, stale state, and empty-plan state.
- `PATCH /api/projects/{projectId}/tasks/{taskId}` must reject mutations when `TaskPlanSnapshot.freshness_status` is not current.
- The same updated `Task` response drives board, gantt, and detail synchronization so the workspace never forks local state per view.
- Cross-domain review with `003-vibetodo-task-plan-synthesis` should verify that only published snapshots are exposed here; review with `002-vibetodo-spec-refinement-workbench` should verify that feedback handoff context is sufficient without introducing workspace-owned persistence.
