# Tasks For 001-vibetodo-project-intake

- brief_id: 001-vibetodo-project-intake
- design_id: 001-vibetodo-project-intake

## Execution Assumptions
- `002-vibetodo-spec-refinement-workbench` design must be cross-reviewed before TASK-009 (E2E) acceptance to confirm that the confirmed intake snapshot supplies sufficient workspace context for the first refinement artifact (`objective_and_outcome`).
- `CD-MOD-001 InitializeProjectFromIntake` must execute atomically — confirmed intake snapshot and active `RefinementSession` must be written in a single transaction. Any partial write must roll back and surface a blocking error to the UI.
- Local Docker environment (TASK-001) must be running before integration and end-to-end test tasks (TASK-008, TASK-009) can be executed.

## Tasks

### TASK-001 Set up local Docker environment with Next.js and PostgreSQL
- requirement_ids:
  - REQ-006
- artifact_refs:
  - overview.md
  - batch-design.md
  - test-plan.md
- common_design_refs:
  - CD-DATA-001
  - CD-MOD-001
- depends_on:
  - none
- implementation_notes:
  - Provide a `docker-compose.yml` that starts a Next.js application server and a PostgreSQL instance in one command.
  - Intake screen must be reachable without any authentication gate in the local environment.
  - PostgreSQL must start before or retry-connect so the app can save drafts even if the DB starts slightly later than the web process.
  - Verify that save, resume, and confirm API calls all reach PostgreSQL inside the compose network.

#### Execution Status
- status: done
- owner: Codex
- last_updated: 2026-03-14 17:18:13 JST

#### Checklist
- [x] implement code
- [x] add or update tests
- [x] run local verification
- [x] review diff

#### Implementation Log
- 2026-03-14 17:18:13 JST: Added a root Next.js 16 TypeScript application with a local `SCR-001` intake screen, App Router API endpoints for draft save and workspace resume, PostgreSQL persistence helpers, and a database bootstrap script so the Docker environment can exercise save, resume, and confirm flows end to end.
- 2026-03-14 17:18:13 JST: Added Docker assets (`Dockerfile`, `docker-compose.yml`, `.dockerignore`) and startup wiring so the web container initializes schema on boot, waits on a healthy PostgreSQL dependency, and serves the intake screen on port 3000 without authentication.
- 2026-03-14 17:18:13 JST: Added Vitest coverage for intake payload normalization and required-field gating, then verified local build plus compose-based save/resume/confirm calls against PostgreSQL. Final review used the working-tree file content plus `git status` because the repository is currently untracked and `git diff` does not emit a tracked patch.

#### Changed Files
- .gitignore
- .dockerignore
- .env.example
- Dockerfile
- app/api/projects/[projectId]/workspace-context/route.ts
- app/api/projects/route.ts
- app/globals.css
- app/layout.tsx
- app/page.tsx
- designs/specific_design/001-vibetodo-project-intake/tasks.md
- docker-compose.yml
- next-env.d.ts
- next.config.ts
- package-lock.json
- package.json
- scripts/init-db.ts
- src/components/intake-app.tsx
- src/lib/intake/db.ts
- src/lib/intake/model.test.ts
- src/lib/intake/model.ts
- src/lib/intake/repository.ts
- src/lib/intake/service.ts
- src/lib/intake/types.ts
- tsconfig.json

#### Verification Results
- status: passed
- commands:
  - npm test
  - npm run build
  - docker compose up --build -d
  - curl -sSf http://localhost:3000
  - curl -sSf -X POST http://localhost:3000/api/projects (generationTrigger=draft_save)
  - curl -sSf http://localhost:3000/api/projects/2685fc6e-e1ac-4fca-be90-ddd742424dd7/workspace-context
  - curl -sSf -X POST http://localhost:3000/api/projects (generationTrigger=intake_confirm)
  - docker compose exec -T db psql -U vibetodo -d vibetodo -c "SELECT p.project_id, p.lifecycle_status, COUNT(rs.refinement_session_id) AS session_count FROM projects p LEFT JOIN refinement_sessions rs ON rs.project_id = p.project_id GROUP BY p.project_id, p.lifecycle_status ORDER BY p.created_at DESC LIMIT 3;"
- notes:
  - `npm test` passed with 2 assertions covering payload normalization and save-versus-confirm gating.
  - `npm run build` passed with Next.js 16.1.6 and produced `/`, `/api/projects`, and `/api/projects/[projectId]/workspace-context`.
  - Compose verification succeeded: the intake screen was reachable at `http://localhost:3000`, draft save returned `draft_intake`, resume preserved the free-form line break, confirm returned `refinement_ready`, and PostgreSQL contained the verified project with one active `RefinementSession`.
  - `docker compose` services remain running after verification so the local environment is immediately available for follow-up work.

---

### TASK-002 Implement data layer — Project and RefinementSession schema and repositories
- requirement_ids:
  - REQ-003
  - REQ-004
- artifact_refs:
  - overview.md
  - sequence-flows/core-flow.md
  - common-design-refs.yaml
- common_design_refs:
  - CD-DATA-001
- depends_on:
  - TASK-001
- implementation_notes:
  - Define PostgreSQL schema for `Project` with fields: `project_id`, `title`, `planning_mode`, `lifecycle_status`, `created_at`, plus `draft_intake_payload` (JSON) for structured and free-form draft data, and `confirmed_intake_snapshot` (JSON) for confirmed state.
  - Define schema for `RefinementSession` with `refinement_session_id`, `project_id`, `status`, `active_artifact_key`, `last_generation_at`.
  - `ProjectRepository` must support upsert by `project_id` (insert on first save; update on resave).
  - `RefinementSessionRepository` must enforce that only one active session exists per `project_id` at a time.
  - Ensure that `Project.lifecycle_status` transitions: `draft_intake` → confirmed (on intake confirmation).

#### Execution Status
- status: done
- owner: Codex
- last_updated: 2026-03-14 17:28:21 JST

#### Checklist
- [x] implement code
- [x] add or update tests
- [x] run local verification
- [x] review diff

#### Implementation Log
- 2026-03-14 17:28:21 JST: Refactored the intake persistence layer into explicit `ProjectRepository` and `RefinementSessionRepository` contracts backed by the PostgreSQL adapter, so the application module no longer embeds SQL-oriented repository behavior inside the orchestration file.
- 2026-03-14 17:28:21 JST: Aligned the `Project.lifecycle_status` confirmation transition with the task design by persisting `draft_intake` drafts and promoting confirmed intake snapshots to `confirmed` while preserving `confirmed_at` and the active-session handoff path.
- 2026-03-14 17:28:21 JST: Added repository-focused Vitest coverage for draft upsert, confirmed snapshot persistence, active refinement-session creation, and the partial unique index that enforces one active session per `project_id`. Reviewed the final task-scoped changes with direct file inspection plus `git status --short` because the repository is currently untracked and `git diff` does not emit a tracked patch.

#### Changed Files
- designs/specific_design/001-vibetodo-project-intake/tasks.md
- package.json
- src/lib/intake/repository.test.ts
- src/lib/intake/repository.ts
- src/lib/intake/service.ts
- src/lib/intake/types.ts

#### Verification Results
- status: passed
- commands:
  - npm test
  - npm run build
  - docker compose ps
  - npm run db:migrate
- notes:
  - `npm test` passed with 6 assertions covering intake payload rules plus repository draft-upsert, confirm, session-creation, and active-session uniqueness behavior.
  - `npm run build` passed with Next.js 16.1.6 after the repository/service boundary refactor.
  - `docker compose ps` confirmed the local PostgreSQL container was healthy before migration.
  - `npm run db:migrate` completed successfully and initialized the schema against the local PostgreSQL environment.

---

### TASK-003 Implement application module commands — SaveProjectDraft and InitializeProjectFromIntake
- requirement_ids:
  - REQ-003
  - REQ-004
- artifact_refs:
  - overview.md
  - sequence-flows/core-flow.md
  - batch-design.md
  - common-design-refs.yaml
- common_design_refs:
  - CD-MOD-001
  - CD-DATA-001
- depends_on:
  - TASK-002
- implementation_notes:
  - `SaveProjectDraft`: upsert `Project` with `lifecycle_status=draft_intake`, storing both structured input fields and free-form context. When `projectId` is present in the payload, update the existing draft rather than creating a new project.
  - `InitializeProjectFromIntake`: atomically write confirmed intake snapshot (structured fields, free-form body, `planning_mode`, `confirmed_at`) to the `Project` and create exactly one active `RefinementSession` with `active_artifact_key=objective_and_outcome`. Roll back both writes if either fails.
  - The module must not embed planning-mode field-set logic; validation of required fields by mode belongs at the UI and API request layer.
  - The module must reject a second `InitializeProjectFromIntake` if an active session already exists for the same `project_id`.

#### Execution Status
- status: done
- owner: Codex
- last_updated: 2026-03-14 17:35:18 JST

#### Checklist
- [x] implement code
- [x] add or update tests
- [x] run local verification
- [x] review diff

#### Implementation Log
- 2026-03-14 17:35:18 JST: Introduced an explicit `IntakeApplicationModule` that owns the `SaveProjectDraft`, `InitializeProjectFromIntake`, and workspace-load commands through injected repository collaborators, aligning the intake workflow with the shared `CD-MOD-001` application-module boundary instead of keeping orchestration in ad hoc helper functions.
- 2026-03-14 17:35:18 JST: Moved mode-specific required-field validation out of the module into request-layer validators used by `POST /api/projects`, so the module now focuses on persistence orchestration, atomic confirmation, and duplicate active-session rejection while the API layer enforces input completeness.
- 2026-03-14 17:35:18 JST: Added Vitest coverage for command orchestration, transaction ordering, active-session conflict normalization, and request-layer validation; reviewed the resulting task-scoped changes with `git diff --no-index --stat` because the repository is currently untracked and standard `git diff` does not provide a tracked baseline.

#### Changed Files
- app/api/projects/route.ts
- designs/specific_design/001-vibetodo-project-intake/tasks.md
- src/lib/intake/application-module.test.ts
- src/lib/intake/application-module.ts
- src/lib/intake/request-validation.test.ts
- src/lib/intake/request-validation.ts
- src/lib/intake/service.ts
- src/lib/intake/types.ts

#### Verification Results
- status: passed
- commands:
  - npm test
  - npm run build
- notes:
  - `npm test` passed with 13 assertions covering intake model rules, repository behavior, command orchestration, transaction ordering, duplicate active-session conflicts, not-found handling, and request-layer validation.
  - `npm run build` passed with Next.js 16.1.6 after the application-module refactor and request-validation move.
  - Diff review used `git diff --no-index --stat` against the task-scoped files because the repository is currently untracked and does not have a tracked baseline for standard `git diff`.

---

### TASK-004 Implement API endpoints — POST /api/projects and GET /api/projects/{projectId}/workspace-context
- requirement_ids:
  - REQ-003
  - REQ-004
- artifact_refs:
  - overview.md
  - sequence-flows/core-flow.md
  - common-design-refs.yaml
  - ui-fields.yaml
- common_design_refs:
  - CD-API-001
  - CD-MOD-001
  - CD-DATA-001
- depends_on:
  - TASK-003
- implementation_notes:
  - `POST /api/projects`: when `projectId` is absent, delegate to `SaveProjectDraft` as initial create; when `projectId` is present and `generationTrigger=draft_save`, delegate to update the same draft. When the payload indicates intake confirm, delegate to `InitializeProjectFromIntake` and return lifecycle fields that let `SCR-001` transition to the review-ready or refinement-ready state.
  - `GET /api/projects/{projectId}/workspace-context`: resume an intake draft and hydrate review state. Return structured input, free-form body, `planning_mode`, and `lifecycle_status` so `SCR-001` can restore the form without losing any content.
  - Response must include lifecycle fields that allow the UI to distinguish `draft_intake`, confirmable, and refinement-ready states.
  - Return a recoverable not-found error when `projectId` does not resolve to an existing draft.

#### Execution Status
- status: done
- owner: Codex
- last_updated: 2026-03-14 17:40:11 JST

#### Checklist
- [x] implement code
- [x] add or update tests
- [x] run local verification
- [x] review diff

#### Implementation Log
- 2026-03-14 17:40:11 JST: Hardened both intake API handlers to return normalized error metadata (`errorCode`, `recoverable`) while preserving the existing `POST /api/projects` delegation to `SaveProjectDraft` and `InitializeProjectFromIntake`, and the existing `GET /api/projects/{projectId}/workspace-context` resume contract.
- 2026-03-14 17:40:11 JST: Added route-scoped Vitest coverage for draft save dispatch, confirm dispatch, validation failure, active-session conflict, workspace resume success, and recoverable draft-not-found handling so `SCR-001` API behavior is verified at the handler boundary required by `CD-API-001`.
- 2026-03-14 17:40:11 JST: Added a Vitest alias config for the repo’s `@/*` imports so the API route tests execute under the same path mapping as Next.js, then reviewed the task-scoped file set with `git diff --no-index --stat /dev/null ...` because the repository is currently untracked and standard `git diff` has no tracked baseline.

#### Changed Files
- app/api/projects/[projectId]/workspace-context/route.test.ts
- app/api/projects/[projectId]/workspace-context/route.ts
- app/api/projects/route.test.ts
- app/api/projects/route.ts
- designs/specific_design/001-vibetodo-project-intake/tasks.md
- vitest.config.mts

#### Verification Results
- status: passed
- commands:
  - npm test
  - npm run build
- notes:
  - `npm test` passed with 6 test files and 19 tests, including dedicated route-handler coverage for draft save, intake confirm, recoverable validation/conflict responses, workspace resume, and recoverable not-found handling.
  - `npm run build` passed with Next.js 16.1.6 and produced the expected app routes for `/api/projects` and `/api/projects/[projectId]/workspace-context`.
  - Diff review used task-scoped `git diff --no-index --stat /dev/null` over the API handlers, new route tests, and `vitest.config.mts` because the repository is currently untracked.

---

### TASK-005 Implement SCR-001 draft editor — mode selector, mode-specific field sets, and save-or-review actions
- requirement_ids:
  - REQ-001
  - REQ-002
- artifact_refs:
  - overview.md
  - ui-fields.yaml
  - common-design-refs.yaml
  - ui-storybook/components/SCR-001-example.html
  - ui-storybook/stories/SCR-001-example.stories.js
- common_design_refs:
  - CD-UI-001
  - CD-MOD-001
- depends_on:
  - TASK-004
- implementation_notes:
  - Render `SCR-001 Intake Start` using the shared screen catalog reference from CD-UI-001. Do not invent a separate screen.
  - Implement `FLD-001` planning mode segmented control. Switching mode must immediately toggle which mode-specific required fields are visible and enforced, without discarding already-entered values in the other mode's shared fields.
  - `project` mode requires: `FLD-003 title`, `FLD-004 objective`, `FLD-005 background_or_current_situation`, `FLD-006 scope_summary`, `FLD-007 stakeholders`, `FLD-009 constraints_or_conditions`, `FLD-010 free_form_context`.
  - `daily_work` mode requires: `FLD-003 title`, `FLD-004 objective`, `FLD-005 background_or_current_situation`, `FLD-008 expected_outcome_or_deliverable`, `FLD-009 constraints_or_conditions`, `FLD-010 free_form_context`.
  - `FLD-002 project_id` allows resuming a draft; when present, call `GET /api/projects/{projectId}/workspace-context` on load.
  - `FLD-011 save_draft_action` must be disabled until the minimum shared required fields (`title`, `objective`, `background_or_current_situation`) are present. On click, call `POST /api/projects` with `generationTrigger=draft_save`.
  - `FLD-012 review_step_action` must be enabled only when all mode-specific required fields plus `free_form_context` are present. On click, switch the screen into the review state without leaving `SCR-001`.
  - Use non-software labels exactly as specified (e.g. "Stakeholders", "Constraints or conditions") to satisfy project coding rules.
  - Free-form context (`FLD-010`) must preserve line breaks on every draft save and resume.

#### Execution Status
- status: done
- owner: Codex
- last_updated: 2026-03-14 17:47:15 JST

#### Checklist
- [x] implement code
- [x] add or update tests
- [x] run local verification
- [x] review diff

#### Implementation Log
- 2026-03-14 17:47:15 JST: Refactored the `SCR-001` draft editor to render its visible field set from a shared metadata source so `project` and `daily_work` modes now use the exact task-specified labels and required-field ordering while preserving already-entered values when the mode changes.
- 2026-03-14 17:47:15 JST: Added draft-resume-on-load support through `?projectId=` plus explicit draft-editor action gating so save remains enabled only for the shared minimum intake scaffold and review activates only when the full mode-specific field set and free-form context are present, without exposing the confirm transition directly from the editor.
- 2026-03-14 17:47:15 JST: Added focused unit coverage for field visibility and draft-versus-review availability, then reviewed the task-scoped diff with `git diff --no-index` because the repository is currently untracked and standard tracked-file diff output is unavailable.

#### Changed Files
- app/globals.css
- designs/specific_design/001-vibetodo-project-intake/tasks.md
- src/components/intake-app.tsx
- src/lib/intake/editor-fields.test.ts
- src/lib/intake/editor-fields.ts

#### Verification Results
- status: passed
- commands:
  - npm test
  - npm run build
- notes:
  - `npm test` passed with 7 test files and 23 tests, including new coverage for project-mode and daily-work field visibility plus save-versus-review action gating.
  - `npm run build` passed with Next.js 16.1.6 and produced the expected `/`, `/api/projects`, and `/api/projects/[projectId]/workspace-context` routes.
  - The `ui-storybook` HTML and story references were used as the visual contract during implementation review, but the repository does not expose a root `npm run storybook` command, so verification stayed at the unit and production-build layers for this task.

---

### TASK-006 Implement SCR-001 pre-start review state — summary display, in-place edit return, and confirm-and-start transition
- requirement_ids:
  - REQ-005
- artifact_refs:
  - overview.md
  - ui-fields.yaml
  - sequence-flows/core-flow.md
  - common-design-refs.yaml
  - ui-storybook/stories/SCR-001-example.stories.js
- common_design_refs:
  - CD-UI-001
  - CD-MOD-001
  - CD-API-001
- depends_on:
  - TASK-005
- implementation_notes:
  - Implement the review state as an internal state of `SCR-001` — do not navigate to a separate screen or URL.
  - `FLD-013 review_structured_summary`: display every mode-relevant field as entered, sourced from the current draft state. Must mirror the values that will seed the first refinement artifact.
  - `FLD-014 review_free_form_summary`: show the full narrative without silent truncation. Long content must remain fully readable (e.g. expandable region or scroll).
  - `FLD-015 edit_before_start_action`: return to the draft editor with all values preserved. No data loss between review and edit transitions.
  - `FLD-016 confirm_and_start_action`: call `POST /api/projects` to trigger `InitializeProjectFromIntake`, which stores `project_id`, `title`, `planning_mode`, confirmed structured input, confirmed free-form input, and `confirmed_at`. On success, navigate to `SCR-002` with `active_artifact_key=objective_and_outcome`. This is the only path that allows entry into `SCR-002`.
  - `FLD-016` must be disabled unless all mode-specific required fields plus `free_form_context` are present.

#### Execution Status
- status: done
- owner: Codex
- last_updated: 2026-03-14 18:00:47 JST

#### Checklist
- [x] implement code
- [x] add or update tests
- [x] run local verification
- [x] review diff

#### Implementation Log
- 2026-03-14 18:00:47 JST: Reworked `SCR-001` so the pre-start review is a true internal state of the intake screen, with a structured summary, full free-form narrative panel, explicit edit return path, and a confirm action that stays disabled until the mode-specific required fields and free-form context are complete.
- 2026-03-14 18:00:47 JST: Wired `FLD-016 confirm_and_start_action` to `POST /api/projects` with `generationTrigger=intake_confirm`, then routed successful confirmations to `/projects/{projectId}/refinement?artifactKey=objective_and_outcome` so the intake bundle now has the required `SCR-002` handoff path.
- 2026-03-14 18:00:47 JST: Added a minimal `SCR-002` refinement-entry page strictly for the cross-domain handoff check required by this bundle. It verifies that the confirmed intake snapshot and active artifact key are present without implementing the downstream refinement workbench task set from `002-vibetodo-spec-refinement-workbench`.

#### Changed Files
- app/globals.css
- app/projects/[projectId]/refinement/page.tsx
- designs/specific_design/001-vibetodo-project-intake/tasks.md
- src/components/intake-app.tsx
- src/lib/intake/ui-state.ts

#### Verification Results
- status: passed
- commands:
  - npm test
  - npm run build
- notes:
  - `npm test` passed with 8 test files and 27 tests, including the new intake UI-state coverage used by the pre-start review flow.
  - `npm run build` passed with the new dynamic route for `/projects/[projectId]/refinement` and the updated `SCR-001` review/confirm flow.

---

### TASK-007 Write unit tests for mode validation, field gating, and lifecycle mapping
- requirement_ids:
  - REQ-001
  - REQ-002
  - REQ-005
- artifact_refs:
  - ui-fields.yaml
  - test-design.md
  - test-plan.md
- common_design_refs:
  - CD-UI-001
- depends_on:
  - TASK-005
  - TASK-006
- implementation_notes:
  - Cover REQ-001: draft save with both structured and free-form inputs; verify resumed draft restores both. Cover missing free-form context surfacing a validation error without discarding structured input.
  - Cover REQ-002: `project` mode enforces its required field set; `daily_work` mode enforces its required field set. Mode-only fields are not enforced in the inactive mode. Non-software labels (e.g. "Constraints or conditions" accepting policy or staffing language) are validated in at least one test case.
  - Cover REQ-005: review state shows all fields before confirm; edit-before-start returns without data loss; rapid edit-review-edit transitions preserve unsaved changes. Confirm button is disabled before required fields are present.
  - Include at least one non-software scenario (e.g. a family event or community project) in the test suite per project coding rules.

#### Execution Status
- status: done
- owner: Codex
- last_updated: 2026-03-14 18:00:47 JST

#### Checklist
- [x] implement code
- [x] add or update tests
- [x] run local verification
- [x] review diff

#### Implementation Log
- 2026-03-14 18:00:47 JST: Added dedicated unit coverage for intake UI-state restoration, lifecycle-to-action mapping, review-summary composition, and the `SCR-002` handoff path so the draft editor and review state logic are exercised through pure domain-oriented helpers.
- 2026-03-14 18:00:47 JST: The new unit scenarios use non-software planning cases such as a community garden launch and weekly pantry prep to satisfy the project rule that tests must not regress into software-only terminology.
- 2026-03-14 18:00:47 JST: Final diff review confirmed the unit-test additions stayed scoped to the selected intake tasks and did not pull implementation from unrelated downstream bundles.

#### Changed Files
- designs/specific_design/001-vibetodo-project-intake/tasks.md
- src/lib/intake/ui-state.test.ts
- src/lib/intake/ui-state.ts

#### Verification Results
- status: passed
- commands:
  - npm test
  - npm run build
- notes:
  - `npm test` passed with 27 assertions across model, validation, repository, route, and new UI-state unit coverage.
  - `npm run build` passed after the helper additions, confirming the new unit-tested utilities integrate with the app/router code paths.

---

### TASK-008 Write integration tests for draft save, resume, and atomic confirm against PostgreSQL
- requirement_ids:
  - REQ-003
  - REQ-004
  - REQ-006
- artifact_refs:
  - sequence-flows/core-flow.md
  - batch-design.md
  - test-design.md
  - test-plan.md
- common_design_refs:
  - CD-API-001
  - CD-DATA-001
  - CD-MOD-001
- depends_on:
  - TASK-004
- implementation_notes:
  - Cover REQ-003: first save creates `Project` with `lifecycle_status=draft_intake`. Subsequent save with the same `project_id` updates the same record, not a new project. Resume with unknown `project_id` returns a recoverable not-found response.
  - Cover REQ-004: confirm action writes `project_id`, `title`, `planning_mode`, confirmed structured input, confirmed free-form input, and `confirmed_at`. Exactly one active `RefinementSession` is created with `active_artifact_key=objective_and_outcome`. Partial write (snapshot written, session fails) rolls back. A second confirm attempt on the same project is rejected.
  - Cover REQ-006: run all integration tests against Docker-based PostgreSQL to prove save, resume, and confirm work in the local environment.
  - Test multiple independent local drafts without authentication side effects.

#### Execution Status
- status: done
- owner: Codex
- last_updated: 2026-03-14 18:00:47 JST

#### Checklist
- [x] implement code
- [x] add or update tests
- [x] run local verification
- [x] review diff

#### Implementation Log
- 2026-03-14 18:00:47 JST: Added a Docker-runtime integration harness that exercises `POST /api/projects` and `GET /api/projects/{projectId}/workspace-context` against the running Next.js app and PostgreSQL container, covering first-save creation, same-`project_id` updates, independent local drafts, resume, confirm, and second-confirm conflict handling.
- 2026-03-14 18:00:47 JST: Added a transaction rollback integration check using the real PostgreSQL transaction runner plus a simulated session-creation failure, proving the confirmed snapshot write is not committed when active-session initialization fails.
- 2026-03-14 18:00:47 JST: Reviewed the integration harness diff after running it against the rebuilt Docker environment so the command list and changed-file ledger match the executed verification path.

#### Changed Files
- designs/specific_design/001-vibetodo-project-intake/tasks.md
- package-lock.json
- package.json
- scripts/intake-test-support.ts
- scripts/test-integration.ts

#### Verification Results
- status: passed
- commands:
  - docker compose up --build -d
  - npm run test:integration
- notes:
  - `docker compose up --build -d` rebuilt the web image and started the Next.js plus PostgreSQL environment used by the integration harness.
  - `npm run test:integration` passed, verifying draft save/update, resume, recoverable not-found behavior, atomic confirm, one-active-session enforcement, and rollback on simulated session-creation failure against Docker-backed PostgreSQL.

---

### TASK-009 Write end-to-end tests for SCR-001 through SCR-002 handoff including local Docker path
- requirement_ids:
  - REQ-001
  - REQ-005
  - REQ-006
- artifact_refs:
  - overview.md
  - sequence-flows/core-flow.md
  - test-design.md
  - test-plan.md
- common_design_refs:
  - CD-UI-001
  - CD-API-001
  - CD-MOD-001
- depends_on:
  - TASK-006
  - TASK-008
- implementation_notes:
  - Run against the local Docker environment (Next.js + PostgreSQL) to confirm the full intake flow is accessible without authentication.
  - Cover the happy path: enter `SCR-001`, select planning mode, fill all mode-specific fields and free-form context, save draft, enter review state, confirm, and land on `SCR-002` with the correct `active_artifact_key`.
  - Cover draft resume: reload the screen with a `project_id`, verify all previously entered values are restored, and complete intake from the resumed state.
  - Cover the review state: verify review surfaces full structured and free-form input without truncation; exercise edit-before-start and re-confirm.
  - Include at least one non-software scenario as per project coding rules.
  - Cross-domain acceptance gate: before marking this task complete, perform cross-domain review with `002-vibetodo-spec-refinement-workbench` to confirm the confirmed intake snapshot is sufficient to enter the refinement workbench.

#### Execution Status
- status: done
- owner: Codex
- last_updated: 2026-03-14 18:00:47 JST

#### Checklist
- [x] implement code
- [x] add or update tests
- [x] run local verification
- [x] review diff

#### Implementation Log
- 2026-03-14 18:00:47 JST: Added a browser-driven end-to-end harness for the local Docker environment that covers the non-software happy path through `SCR-001`, including draft save, query-param resume, pre-start review visibility, edit-before-start, re-review, confirm, and landing on `SCR-002` with `active_artifact_key=objective_and_outcome`.
- 2026-03-14 18:00:47 JST: Added the minimal `SCR-002` refinement-entry route required for the intake-to-refinement handoff acceptance gate and used it to confirm that the confirmed intake snapshot still contains the full structured and free-form context expected by `002-vibetodo-spec-refinement-workbench`.
- 2026-03-14 18:00:47 JST: Cross-domain acceptance for this bundle was completed by checking the `002-vibetodo-spec-refinement-workbench` overview and common-design refs against the implemented handoff route, then verifying the browser flow lands on the refinement entry surface with the confirmed snapshot and active artifact key intact.

#### Changed Files
- app/globals.css
- app/projects/[projectId]/refinement/page.tsx
- designs/specific_design/001-vibetodo-project-intake/tasks.md
- package-lock.json
- package.json
- scripts/intake-test-support.ts
- scripts/test-e2e.ts
- src/components/intake-app.tsx
- src/lib/intake/ui-state.ts

#### Verification Results
- status: passed
- commands:
  - docker compose up --build -d
  - npx playwright install chromium
  - npm run test:e2e
- notes:
  - `docker compose up --build -d` provided the local Next.js plus PostgreSQL path required by the task bundle before the browser test ran.
  - `npx playwright install chromium` completed successfully so the repo-local E2E script could launch a real browser.
  - `npm run test:e2e` passed, covering save, resume, full review visibility, edit-before-start, confirm, and the `SCR-002` landing state with `objective_and_outcome` shown after confirmation.

## Dependency Order
- TASK-001
- TASK-002
- TASK-003
- TASK-004
- TASK-005
- TASK-006
- TASK-007 (can start after TASK-005 and TASK-006)
- TASK-008 (can start after TASK-004, in parallel with TASK-005 and TASK-006)
- TASK-009 (requires TASK-006 and TASK-008)

## Test References
- REQ-001 -> test-design.md § REQ-001 / test-plan.md
- REQ-002 -> test-design.md § REQ-002 / test-plan.md
- REQ-003 -> test-design.md § REQ-003 / test-plan.md
- REQ-004 -> test-design.md § REQ-004 / test-plan.md
- REQ-005 -> test-design.md § REQ-005 / test-plan.md
- REQ-006 -> test-design.md § REQ-006 / test-plan.md

## Archived Execution History
