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
  - REQ-008
  - REQ-009

```mermaid
sequenceDiagram
    participant User
    participant SCR004 as SCR-004 UI
    participant API as Project Planning API
    participant Module as Planning Application Module
    participant Planner as TaskSynthesisEngine
    participant Provider as LLM Provider Adapter
    participant DB as PostgreSQL
    participant SCR005 as SCR-005 UI

    User->>SCR004: Open task synthesis for project_id
    SCR004->>API: GET /api/projects/{projectId}/workspace-context
    API->>Module: ReturnProjectWorkspaceContext(projectId)
    Module->>DB: Load required artifact summaries, latest task plan, stale state
    DB-->>Module: Approved artifact set and current task plan context
    Module-->>API: artifactSummaries, taskPlanSummary, allowedActions, staleDependencies
    API-->>SCR004: Render eligibility gate and latest snapshot state
    User->>SCR004: Trigger synthesize task plan
    SCR004->>API: POST /api/projects/{projectId}/task-plans (generationTrigger=synthesize)
    API->>Module: SynthesizeTaskPlan(projectId, current approved artifact set)
    Module->>DB: Persist synthesis job and freeze source artifact snapshot IDs
    Module->>Planner: Generate candidate task plan through provider-neutral port
    Planner->>Provider: Optional AI-assisted decomposition request
    Provider-->>Planner: Structured task proposal and rationale
    Planner-->>Module: Candidate tasks, dependencies, placeholder reasons, traceability mapping
    Module->>DB: Persist TaskPlanSnapshot, Task rows, TaskArtifactLink rows, publish blockers
    DB-->>Module: Candidate snapshot and ordered task set
    Module-->>API: job status, candidate snapshot metadata, tasks
    API-->>SCR004: Show reviewable task table and task detail editor
    User->>SCR004: Correct canonical fields or dependencies for one task
    SCR004->>API: PATCH /api/projects/{projectId}/tasks/{taskId}
    API->>Module: UpdateTask(taskId, taskPatch, taskPlanSnapshotId)
    Module->>DB: Validate canonical shape and preserve traceability links
    DB-->>Module: Updated task within selected snapshot
    Module-->>API: Refreshed task and publish blockers
    API-->>SCR004: Render updated candidate snapshot
    User->>SCR004: Publish reviewed task plan
    SCR004->>API: POST /api/projects/{projectId}/task-plans (taskPlanSnapshotId, approvalDecision=publish)
    API->>Module: PublishTaskPlanSnapshot(projectId, taskPlanSnapshotId)
    Module->>DB: Confirm no blockers, mark snapshot current published, demote prior published plan
    DB-->>Module: Current published task plan summary
    Module-->>API: Published snapshot and workspace-ready task set
    API-->>SCR004: Publish success and SCR-005 handoff
    SCR004-->>SCR005: Open management workspace with current published task plan
    SCR005-->>User: Render editable kanban and read-only gantt from the published snapshot
```

## Sequence Notes
- The eligibility gate depends on the same required artifact sequence produced by `002-vibetodo-spec-refinement-workbench`; `SCR-004` does not reinterpret readiness locally.
- Candidate task plans and the current published task plan are separate snapshot states. Generation and correction never auto-promote a candidate into the workspace source of truth.
- Pre-publish correction is intentionally narrow: field values and dependencies may change, but task identity, snapshot traceability, and artifact links must survive every patch.
- Publish succeeds only when every task has non-null canonical required fields, at least one related artifact link, and no unresolved synthesis failure reason.
- If any source artifact in the published task plan is later replaced by a newer approved snapshot, the module marks the task plan `stale`; `SCR-004` becomes the regeneration and republish boundary, and `SCR-005` must treat the stale plan as read-only.
