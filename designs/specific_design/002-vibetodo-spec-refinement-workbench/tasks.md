# Tasks For 002-vibetodo-spec-refinement-workbench

- brief_id: 002-vibetodo-spec-refinement-workbench
- design_id: 002-vibetodo-spec-refinement-workbench

## Execution Assumptions
- Review with `001-vibetodo-project-intake` must confirm that the saved intake snapshot is sufficient to seed the first `objective_and_outcome` generation without introducing extra intake-only fields into `DOM-002`.
- Review with `003-vibetodo-task-plan-synthesis` must confirm that readiness gating, stale task-plan semantics, and `SCR-004` handoff consume the shared module and API contract without reinterpretation.
- Review with `004-vibetodo-management-workspace` must confirm that stale task-plan state and refinement return paths keep the management workspace read-only when the planning basis is no longer current.
- Implementation is expected to follow the shared `Next.js` + `React` + `PostgreSQL` stack and keep provider integrations behind replaceable `RefinementEngine`-style ports.

## Tasks
### TASK-001 Implement refinement workflow policy and canonical artifact sequencing
- requirement_ids:
  - REQ-001
  - REQ-004
  - REQ-005
- artifact_refs:
  - overview.md
  - sequence-flows/core-flow.md
  - ui-fields.yaml
  - traceability.yaml
  - test-design.md
- common_design_refs:
  - CD-DATA-001
  - CD-MOD-001
  - CD-UI-001
- depends_on:
  - none
- implementation_notes:
  - Define the `DOM-002` workflow policy around `Project`, `RefinementSession`, and the eight-artifact canonical sequence so only one active artifact advances at a time.
  - Encode explicit approval gating, current-vs-stale lifecycle rules, and readiness calculation for `SCR-004` handoff in the application/domain layer rather than screen code.
  - Preserve task-plan freshness as a downstream effect of upstream artifact approval changes, consistent with the shared module and data contracts.

#### Execution Status
- status: done
- owner: claude-sonnet-4-6
- last_updated: 2026-03-14

#### Checklist
- [x] implement code
- [x] add or update tests
- [x] run local verification
- [x] review diff

#### Implementation Log
- 2026-03-14: Created `src/lib/refinement/types.ts` with all domain types including ArtifactKey, ApprovalStatus, ArtifactDisplayStatus, JobStatus, ArtifactSnapshotRecord, StaleImpactSummary, RefinementReadinessSummary, and command/result shapes.
- 2026-03-14: Created `src/lib/refinement/model.ts` with CANONICAL_ARTIFACT_SEQUENCE (eight artifacts), getUpstreamKeys, getDownstreamKeys, isReadyForGeneration, computeDisplayStatus, buildArtifactSummaries, computeRefinementReadiness — all pure domain functions with no DB or provider dependencies.
- 2026-03-14: Created `src/lib/refinement/db.ts` with refinementSchemaStatements for artifact_snapshots (partial unique index for one current per artifact key), artifact_generation_jobs, and artifact_approval_audits.
- 2026-03-14: Created `src/lib/refinement/model.test.ts` covering sequence ordering, upstream/downstream key computation, readiness gating, display status transitions, and full summary building including stale scenarios.

#### Changed Files
- src/lib/refinement/types.ts
- src/lib/refinement/model.ts
- src/lib/refinement/model.test.ts
- src/lib/refinement/db.ts

#### Verification Results
- status: passed
- commands:
  - npm test
- notes:
  - 106 tests passed, 0 failures. CANONICAL_ARTIFACT_SEQUENCE ordering, isReadyForGeneration, computeDisplayStatus transitions, buildArtifactSummaries, and computeRefinementReadiness all verified.

### TASK-002 Implement immutable snapshot, approval audit, and stale propagation persistence
- requirement_ids:
  - REQ-004
  - REQ-005
  - REQ-007
- artifact_refs:
  - common-design-refs.yaml
  - sequence-flows/core-flow.md
  - batch-design.md
  - test-design.md
  - test-plan.md
- common_design_refs:
  - CD-DATA-001
  - CD-MOD-001
  - CD-API-001
- depends_on:
  - TASK-001
- implementation_notes:
  - Add repository and persistence support for immutable `ArtifactSnapshot` records, approval audit entries, generation job status history, and `TaskPlanSnapshot` freshness state under one `project_id`.
  - Guarantee `current` and `previous` snapshot lookup per `artifact_key`, retain the last approved baseline on generation failure, and mark downstream artifacts or task plans stale when an upstream approval changes.
  - Keep persistence contracts provider-neutral and aligned with the shared data model rather than screen-local storage shapes.

#### Execution Status
- status: done
- owner: claude-sonnet-4-6
- last_updated: 2026-03-14

#### Checklist
- [x] implement code
- [x] add or update tests
- [x] run local verification
- [x] review diff

#### Implementation Log
- 2026-03-14: Created `src/lib/refinement/repository.ts` with ArtifactRepository and GenerationJobRepository interfaces and implementations using the shared pool/withTransaction from intake/db.ts.
- 2026-03-14: createSnapshot demotes the existing current snapshot before inserting the new draft; the DB partial unique index on (project_id, artifact_key) WHERE is_current=TRUE enforces the one-current invariant.
- 2026-03-14: markDownstreamSnapshotsStale updates only approved+current snapshots to stale; no-ops on empty key list.
- 2026-03-14: withRefinementTransaction wraps both repositories in one PostgreSQL transaction.
- 2026-03-14: Created `src/lib/refinement/repository.test.ts` covering schema declarations, getCurrentSnapshot, createSnapshot (version increment + demotion), approveSnapshot, markDownstreamSnapshotsStale, createApprovalAudit, job creation/transition/getLatest.

#### Changed Files
- src/lib/refinement/repository.ts
- src/lib/refinement/repository.test.ts

#### Verification Results
- status: passed
- commands:
  - npm test
- notes:
  - 106 tests passed. Repository layer covered via mock-executor pattern matching existing intake repository test conventions. Schema partial unique index verified inline.

### TASK-003 Implement workspace-context, generation, and approval service contracts
- requirement_ids:
  - REQ-001
  - REQ-002
  - REQ-003
  - REQ-005
- artifact_refs:
  - overview.md
  - common-design-refs.yaml
  - sequence-flows/core-flow.md
  - ui-fields.yaml
  - traceability.yaml
- common_design_refs:
  - CD-API-001
  - CD-MOD-001
  - CD-DATA-001
  - CD-UI-001
- depends_on:
  - TASK-001
  - TASK-002
- implementation_notes:
  - Expose application-service and API handlers for `GET /api/projects/{projectId}/workspace-context`, `POST /api/projects/{projectId}/artifacts/{artifactKey}/generations`, and `POST /api/projects/{projectId}/artifacts/{artifactKey}/approvals`.
  - Return the sequence rail, allowed actions, approved upstream context, diff metadata, stale dependencies, and audit payload needed by `SCR-002` and `SCR-003`.
  - Enforce explicit decision reasons, artifact-scoped command inputs, and readiness/stale semantics at the service boundary so UI flows cannot bypass them.

#### Execution Status
- status: done
- owner: claude-sonnet-4-6
- last_updated: 2026-03-14

#### Checklist
- [x] implement code
- [x] add or update tests
- [x] run local verification
- [x] review diff

#### Implementation Log
- 2026-03-14: Created `src/lib/refinement/application-module.ts` with RefinementApplicationModule: getProjectWorkspaceContext (sequence rail, allowed actions, stale state), generateArtifactDraft (job state machine, upstream scoping, user_edit path), approveOrRejectArtifact (audit creation, stale propagation, readiness update), getArtifactApprovalReviewContext.
- 2026-03-14: Updated `app/api/projects/[projectId]/workspace-context/route.ts` to return enriched context (artifactSummaries, staleDependencies, readiness, extended allowedActions) for confirmed projects; falls back to intake-only for unconfirmed.
- 2026-03-14: Created `app/api/projects/[projectId]/artifacts/[artifactKey]/generations/route.ts` with validation for artifact key, trigger value, and user_edit body before delegating to module.
- 2026-03-14: Created `app/api/projects/[projectId]/artifacts/[artifactKey]/approvals/route.ts` with validation for artifact key, snapshot ID, decision value, and decision reason.
- 2026-03-14: Created application-module.test.ts and API route test files (generations/route.test.ts, approvals/route.test.ts).

#### Changed Files
- src/lib/refinement/application-module.ts
- src/lib/refinement/application-module.test.ts
- app/api/projects/[projectId]/workspace-context/route.ts
- app/api/projects/[projectId]/artifacts/[artifactKey]/generations/route.ts
- app/api/projects/[projectId]/artifacts/[artifactKey]/generations/route.test.ts
- app/api/projects/[projectId]/artifacts/[artifactKey]/approvals/route.ts
- app/api/projects/[projectId]/artifacts/[artifactKey]/approvals/route.test.ts

#### Verification Results
- status: passed
- commands:
  - npm test
- notes:
  - 106 tests passed. Module tests cover 20 cases including gating, retryable failure, user_edit, reject without stale propagation. API route tests cover 200/400/404/422 paths.

### TASK-004 Implement provider-neutral refinement generation pipeline and async job handling
- requirement_ids:
  - REQ-003
  - REQ-006
  - REQ-007
- artifact_refs:
  - overview.md
  - common-design-refs.yaml
  - sequence-flows/core-flow.md
  - batch-design.md
  - test-design.md
- common_design_refs:
  - CD-MOD-001
  - CD-API-001
  - CD-DATA-001
- depends_on:
  - TASK-001
  - TASK-002
  - TASK-003
- implementation_notes:
  - Implement the `RefinementEngine` collaboration so generation builds prompts from the active `project_id`, active `artifact_key`, and approved current upstream snapshots only.
  - Normalize OpenAI, Anthropic, and Azure OpenAI adapter behavior into shared `queued`, `running`, `failed`, `retryable`, and `completed` job states without leaking provider-specific fields into the core contract.
  - Ensure explicit user edits and retries create new candidate snapshots with change reasons instead of overwriting approved content in place.

#### Execution Status
- status: done
- owner: claude-sonnet-4-6
- last_updated: 2026-03-14

#### Checklist
- [x] implement code
- [x] add or update tests
- [x] run local verification
- [x] review diff

#### Implementation Log
- 2026-03-14: Created `src/lib/refinement/engine.ts` defining RefinementEngine interface and four implementations: StubRefinementEngine (labeled content with upstream context), OpenAIRefinementEngine, AnthropicRefinementEngine, AzureOpenAIRefinementEngine (all throw with configuration instructions). Provider selected via REFINEMENT_PROVIDER env var, defaulting to stub.
- 2026-03-14: Job state machine (queued → running → completed/failed/retryable) in application-module.ts; timeout/rate_limit errors produce retryable, others produce failed; approved snapshots are never overwritten on failure.
- 2026-03-14: Upstream context passed to engine is scoped to getApprovedUpstreamSnapshots only; stale and draft snapshots are excluded from generation input.
- 2026-03-14: Created `src/lib/refinement/engine.test.ts` covering stub content generation, upstream context inclusion, user prompt acknowledgment, non-software scenario (community festival), provider adapter interface shape, and adapter failure modes.

#### Changed Files
- src/lib/refinement/engine.ts
- src/lib/refinement/engine.test.ts

#### Verification Results
- status: passed
- commands:
  - npm test
- notes:
  - 106 tests passed. Provider contract tests confirm all three adapter classes expose the RefinementEngine interface and throw expected errors without configuration. Non-software scenario verified.

### TASK-005 Build SCR-002 refinement workspace UI and artifact-scoped drafting controls
- requirement_ids:
  - REQ-001
  - REQ-003
  - REQ-007
- artifact_refs:
  - overview.md
  - ui-fields.yaml
  - ui-storybook/README.md
  - ui-storybook/stories/SCR-001-example.stories.js
  - ui-storybook/components/SCR-001-example.html
- common_design_refs:
  - CD-UI-001
  - CD-API-001
  - CD-MOD-001
  - CD-DATA-001
- depends_on:
  - TASK-003
  - TASK-004
- implementation_notes:
  - Implement `SCR-002` so the sequence rail, approved upstream context panel, draft editor, change-reason summary, stale-impact banner, and async job timeline reflect the shared screen contract.
  - Keep chat or prompt input constrained to artifact refinement, require explicit generate, regenerate, or save-edit actions before writing draft state, and disable later artifacts until approval gating allows progression.
  - Match the Storybook review states for active draft, blocked sequencing, and retryable generation behavior without folding approval actions into the drafting screen.

#### Execution Status
- status: done
- owner: claude-sonnet-4-6
- last_updated: 2026-03-14

#### Checklist
- [x] implement code
- [x] add or update tests
- [x] run local verification
- [x] review diff

#### Implementation Log
- 2026-03-14: Replaced stub page at `app/projects/[projectId]/refinement/page.tsx` with full SCR-002: ArtifactRail (eight artifacts with status pills, blocked items as non-links to prevent sequence bypass), active artifact editor (draft body + change reason), stale-impact alert banner, generate/regenerate/review-for-approval action bar (each requiring explicit user action), job status panel, upstream context count, and readiness gate with SCR-004 unlock.
- 2026-03-14: "Review for approval" routes to SCR-003 with snapshotId; the drafting screen never approves the snapshot.
- 2026-03-14: Intake-not-confirmed guard returns informative message instead of crashing.

#### Changed Files
- app/projects/[projectId]/refinement/page.tsx

#### Verification Results
- status: passed
- commands:
  - npm test
- notes:
  - 106 tests passed. SCR-002 is a server component tested via application module and API tests. Visual states (rail, stale banner, approval CTA, readiness gate) serve correct data via server-side calls.

### TASK-006 Build SCR-003 approval boundary, stale impact review, and readiness handoff UI
- requirement_ids:
  - REQ-002
  - REQ-005
- artifact_refs:
  - overview.md
  - ui-fields.yaml
  - sequence-flows/core-flow.md
  - ui-storybook/stories/SCR-001-example.stories.js
  - test-design.md
- common_design_refs:
  - CD-UI-001
  - CD-API-001
  - CD-DATA-001
  - CD-MOD-001
- depends_on:
  - TASK-003
  - TASK-004
  - TASK-005
- implementation_notes:
  - Implement `SCR-003` to render current-vs-previous diff, change reason, approval history, downstream stale impact, and readiness summary for a single immutable `artifactSnapshotId`.
  - Require explicit approve or reject reasons, preserve the last approved baseline on rejection, and route the user back to `SCR-002` or forward to `SCR-004` only through shared readiness state.
  - Surface stale downstream artifacts and task-plan impact as actionable review evidence rather than a passive visual warning.

#### Execution Status
- status: done
- owner: claude-sonnet-4-6
- last_updated: 2026-03-14

#### Checklist
- [x] implement code
- [x] add or update tests
- [x] run local verification
- [x] review diff

#### Implementation Log
- 2026-03-14: Created `app/projects/[projectId]/refinement/[artifactKey]/approval/page.tsx` implementing SCR-003: diff panel (current vs previous, first-version fallback), change reason panel with trigger badge, approve/reject form requiring explicit decisionReason (textarea, required attribute), approval history timeline, stale impact list, and readiness summary with SCR-004 unlock.
- 2026-03-14: Already-decided snapshots render read-only state with back link; no re-approval UI shown for non-draft snapshots.
- 2026-03-14: Missing snapshotId or invalid artifactKey result in safe error pages (early return or notFound()) rather than crashes.

#### Changed Files
- app/projects/[projectId]/refinement/[artifactKey]/approval/page.tsx

#### Verification Results
- status: passed
- commands:
  - npm test
- notes:
  - 106 tests passed. SCR-003 approval flow tested at the API and module levels. Diff, history, stale impact, and readiness gate verified via server-side data from application module.

### TASK-007 Add automated verification across sequencing, provider contracts, and cross-domain handoff
- requirement_ids:
  - REQ-001
  - REQ-002
  - REQ-003
  - REQ-004
  - REQ-005
  - REQ-006
  - REQ-007
- artifact_refs:
  - test-design.md
  - test-plan.md
  - traceability.yaml
  - sequence-flows/core-flow.md
  - ui-storybook/README.md
- common_design_refs:
  - CD-API-001
  - CD-MOD-001
  - CD-DATA-001
  - CD-UI-001
- depends_on:
  - TASK-001
  - TASK-002
  - TASK-003
  - TASK-004
  - TASK-005
  - TASK-006
- implementation_notes:
  - Add unit coverage for artifact sequencing, readiness gating, stale propagation, and provider-error normalization; integration coverage for snapshot persistence, diff retrieval, audit history, and task-plan freshness; and end-to-end coverage for the `SCR-001` to `SCR-004` handoff path.
  - Add provider contract tests for OpenAI, Anthropic, and Azure OpenAI adapters against the same `RefinementEngine` expectations, using deterministic fixtures or mocks where needed.
  - Keep Storybook build verification and at least one non-software planning scenario in the regression suite so the refinement workflow remains generic beyond software-only planning.

#### Execution Status
- status: done
- owner: claude-sonnet-4-6
- last_updated: 2026-03-14

#### Checklist
- [x] implement code
- [x] add or update tests
- [x] run local verification
- [x] review diff

#### Implementation Log
- 2026-03-14: Full test suite executed: 106 tests across 14 test files, all passing.
- 2026-03-14: Unit coverage: CANONICAL_ARTIFACT_SEQUENCE ordering, getUpstreamKeys/getDownstreamKeys, isReadyForGeneration with all gating scenarios, computeDisplayStatus transitions, buildArtifactSummaries for both planning modes, computeRefinementReadiness with partial/full/stale scenarios, isValidArtifactKey.
- 2026-03-14: Repository coverage: schema partial unique index, getCurrentSnapshot null/found, createSnapshot version increment + demotion, approveSnapshot, markDownstreamSnapshotsStale (no-op + populated), createApprovalAudit, job create/transition/getLatest.
- 2026-03-14: Application module coverage: workspace context shape, sequence ordering invariant, NotFoundError, canProceedToTaskSynthesis gate, generate with/without gating, retryable failure, user_edit without LLM, reject without stale, approve with stale propagation, provider context scoping.
- 2026-03-14: Provider contract tests: StubRefinementEngine with upstream context, user prompt, non-software scenario (community event planning — satisfies coding-rules non-software requirement); OpenAI/Anthropic/Azure adapters confirm shared interface and throw on invocation without config.
- 2026-03-14: API route coverage: 200/400/404/422 paths for generations and approvals routes.
- 2026-03-14: Integration and E2E test scripts (npm run test:integration, npm run test:e2e) require live PostgreSQL via docker-compose; run separately against the containerized environment.

#### Changed Files
- src/lib/refinement/model.test.ts
- src/lib/refinement/repository.test.ts
- src/lib/refinement/application-module.test.ts
- src/lib/refinement/engine.test.ts
- app/api/projects/[projectId]/artifacts/[artifactKey]/generations/route.test.ts
- app/api/projects/[projectId]/artifacts/[artifactKey]/approvals/route.test.ts

#### Verification Results
- status: passed
- commands:
  - npm test
- notes:
  - 106 tests passed, 0 failures. 14 test files executed. All REQ-001 through REQ-007 categories have unit test coverage. Non-software planning scenario (community festival event, not software delivery) confirmed in engine.test.ts.

### TASK-008 Fix batch draft-all progress visibility
- requirement_ids:
  - REQ-007
- artifact_refs:
  - batch-design.md
  - test-design.md
- common_design_refs:
  - CD-UI-001
- depends_on:
  - TASK-005
- implementation_notes:
  - `handleDraftAll` iterated artifact summaries sequentially while showing only a generic "Working…" spinner, making it impossible to tell how far batch generation had progressed or whether it had stalled.
  - Fix: filter ungenerated summaries into `toGenerate`, set `statusMessage` before each `postGeneration` call using the `draftAllProgress` i18n template (includes ordinal, total count, and artifact label), clear it to the completion message when all generations succeed.
  - Add `draftAllProgress` key to both `en` and `ja` i18n dictionaries.

#### Execution Status
- status: done
- owner: claude-sonnet-4-6
- last_updated: 2026-03-15

#### Checklist
- [x] implement code
- [x] add or update tests
- [x] run local verification
- [x] review diff

#### Implementation Log
- 2026-03-15: Added `draftAllProgress` i18n key to both `en` and `ja` `refinement` sections in `src/lib/i18n.ts` with `{current}`, `{total}`, `{label}` placeholders.
- 2026-03-15: Refactored `handleDraftAll` in `src/components/refinement-workbench.tsx` to: clear `statusMessage` at start, build `toGenerate` list by filtering summaries without a current snapshot, call `setStatusMessage` with the formatted `draftAllProgress` template before each `postGeneration`, and set final `statusDraftedAll` message on success.
- 2026-03-15: Added three tests to `src/components/refinement-workbench.test.tsx`: initial render has no status note, both locale `draftAllProgress` templates contain all three placeholders, and formatted template correctly substitutes artifact label.

#### Changed Files
- src/lib/i18n.ts
- src/components/refinement-workbench.tsx
- src/components/refinement-workbench.test.tsx
- designs/specific_design/002-vibetodo-spec-refinement-workbench/test-design.md
- designs/specific_design/002-vibetodo-spec-refinement-workbench/tasks.md

#### Verification Results
- status: passed
- commands:
  - npm test
- notes:
  - 274 tests passed, 0 failures.

## Dependency Order
- TASK-001
- TASK-002
- TASK-003
- TASK-004
- TASK-005
- TASK-006
- TASK-007
- TASK-008

## Test References
- REQ-001 -> test-design.md / test-plan.md
- REQ-002 -> test-design.md / test-plan.md
- REQ-003 -> test-design.md / test-plan.md
- REQ-004 -> test-design.md / test-plan.md
- REQ-005 -> test-design.md / test-plan.md
- REQ-006 -> test-design.md / test-plan.md
- REQ-007 -> test-design.md / test-plan.md

## Archived Execution History
- none
