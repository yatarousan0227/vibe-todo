# CD-API-001 Shared API Design

- common_design_id: CD-API-001
- kind: api

## Shared Purpose
CD-API-001 は、VibeToDo の intake、refinement、task synthesis、management workspace が同じ `Project` とその planning lifecycle を共有するための canonical API contract である。各 feature が個別に endpoint 命名や状態遷移ルールを持つと、artifact approval、stale propagation、task traceability が画面単位で分裂するため、本 API は cross-feature shared design として扱う。

この API は `DOM-001` から `DOM-004` までを貫く application boundary であり、UI はこの契約に従って command と query を発行する。LLM provider や PostgreSQL の都合は API surface に露出しない。

## Canonical Interface
- resource: `Project Planning Workflow`
- operations:
  - `POST /api/projects`
  - `GET /api/projects/{projectId}/workspace-context`
  - `POST /api/projects/{projectId}/artifacts/{artifactKey}/generations`
  - `POST /api/projects/{projectId}/artifacts/{artifactKey}/approvals`
  - `POST /api/projects/{projectId}/task-plans`
  - `PATCH /api/projects/{projectId}/tasks/{taskId}`
- consumers:
  - `briefs/001-vibetodo-project-intake.md`
  - `briefs/002-vibetodo-spec-refinement-workbench.md`
  - `briefs/003-vibetodo-task-plan-synthesis.md`
  - `briefs/004-vibetodo-management-workspace.md`
- invariants:
  - すべての command と query は `projectId` を root context として扱い、screen 固有の一時識別子を source of truth にしてはならない
  - artifact generation と approval は `artifactKey` ごとの明示 command とし、暗黙遷移や自動承認を許可しない
  - task plan generation は approved かつ current な artifact snapshot 群が揃っている場合にのみ受理される
  - task update は `Related Artifacts` と task-to-plan traceability を失わない partial update に限定する
  - response には UI が stale、approved、in_progress、blocked を判定できる lifecycle fields を含める
  - OpenAI、Anthropic、Azure OpenAI など provider 固有情報は request/response の必須契約に含めない
  - versioning は additive change を前提にし、breaking change は `/v2` のような path version ではなく contract revision の明示管理で扱う

## Shared Request Fields
- `projectId`
- `workspaceContextIncludes`
- `artifactKey`
- `artifactSnapshotId`
- `approvalDecision`
- `generationTrigger`
- `taskPlanSnapshotId`
- `taskPatch`
- `clientRevision`

## Shared Response Fields
- `project`
- `refinementSession`
- `artifactSummaries`
- `artifactSnapshot`
- `taskPlanSummary`
- `tasks`
- `allowedActions`
- `staleDependencies`
- `auditMeta`

## Downstream Usage
- `briefs/001-vibetodo-project-intake.md` は `POST /api/projects` で mixed input と refinement session 初期化を開始する
- `briefs/002-vibetodo-spec-refinement-workbench.md` は workspace context、artifact generation、artifact approval を参照する
- `briefs/003-vibetodo-task-plan-synthesis.md` は task plan generation と artifact traceability を参照する
- `briefs/004-vibetodo-management-workspace.md` は workspace context と task update contract を参照する
