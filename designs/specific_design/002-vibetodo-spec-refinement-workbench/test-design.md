# Test Design

## Requirement Coverage

### REQ-001
- normal_cases:
  - the artifact sequence rail shows all eight required artifacts in the same order for `project` and `daily_work`
  - the next artifact remains blocked until the current artifact has an approved and current snapshot
- error_cases:
  - the UI allows skipping from `objective_and_outcome` directly to `deliverables_and_milestones` without an approval boundary
  - task synthesis readiness is shown while one required artifact remains unapproved
- boundary_cases:
  - a project with only the first artifact approved still shows the remaining artifacts as blocked rather than absent
  - switching between already-approved and still-blocked artifacts does not rewrite `active_artifact_key`
- references:
  - overview.md
  - ui-fields.yaml
  - sequence-flows/core-flow.md
  - common-design-refs.yaml

### REQ-002
- normal_cases:
  - `SCR-003` shows current draft, previous snapshot diff, and change reason before the user approves
  - rejecting a snapshot returns the user to refinement while preserving the last approved snapshot as the planning baseline
- error_cases:
  - approve action succeeds without a decision reason
  - the approval screen hides downstream stale impact even though downstream artifacts or task plans are affected
- boundary_cases:
  - the first snapshot for an artifact has no previous diff and the screen shows a first-version state instead of breaking
  - approval history remains readable after multiple approve and reject cycles for the same artifact key
- references:
  - overview.md
  - ui-fields.yaml
  - sequence-flows/core-flow.md
  - ui-storybook/stories/SCR-001-example.stories.js

### REQ-003
- normal_cases:
  - the generation request uses only the active `project_id`, the active `artifact_key`, and approved current upstream snapshots
  - chat output remains advisory until the user explicitly generates, regenerates, or saves an edit
- error_cases:
  - a prompt asking for unrelated general advice is accepted and treated as in-scope refinement
  - downstream or stale snapshots leak into the upstream context panel and the generation payload
- boundary_cases:
  - a project with only one approved upstream artifact still generates correctly for the next artifact
  - a long prompt containing both valid refinement intent and unrelated generic questions is rejected or trimmed to the supported scope
- references:
  - overview.md
  - ui-fields.yaml
  - sequence-flows/core-flow.md
  - common-design-refs.yaml

### REQ-004
- normal_cases:
  - every generate, regenerate, and explicit user edit creates a new immutable `ArtifactSnapshot` with version number, change reason, and audit metadata
  - the approval screen can retrieve the current snapshot and the immediately previous snapshot diff for the same artifact
- error_cases:
  - regeneration overwrites the last approved snapshot in place and destroys audit history
  - approval audit omits decision timestamp or decision reason
- boundary_cases:
  - the first snapshot for an artifact is still reviewable even without a previous snapshot
  - multiple snapshots generated in rapid succession still preserve correct current and previous links
- references:
  - sequence-flows/core-flow.md
  - batch-design.md
  - common-design-refs.yaml
  - traceability.yaml

### REQ-005
- normal_cases:
  - approving an updated upstream artifact marks every downstream artifact and the latest task plan snapshot as stale
  - readiness remains blocked until stale downstream artifacts are regenerated or re-approved
- error_cases:
  - downstream artifacts remain marked current after their upstream planning basis changes
  - stale task plan messaging does not identify the blocking artifact key or required follow-up action
- boundary_cases:
  - changing the final artifact in sequence does not mark earlier artifacts stale
  - a project with no task plan yet still shows downstream artifact stale impact without referencing a nonexistent task plan snapshot
- references:
  - overview.md
  - ui-fields.yaml
  - sequence-flows/core-flow.md
  - test-plan.md

### REQ-006
- normal_cases:
  - switching the configured provider from OpenAI to Anthropic or Azure OpenAI does not change the module or screen contract
  - provider errors are normalized into the same application-level generation failure states
- error_cases:
  - provider-specific model settings leak into required API request or response fields
  - the refinement module directly depends on provider SDK types instead of the shared port
- boundary_cases:
  - a provider returns partial rationale but full draft content and the system still records a valid change reason
  - a provider is unavailable at startup and the workbench still loads while generation actions fail gracefully
- references:
  - common-design-refs.yaml
  - batch-design.md
  - sequence-flows/core-flow.md
  - traceability.yaml

### REQ-007
- normal_cases:
  - a long-running generation job progresses through `queued`, `running`, and `completed`, and the UI updates without page reload
  - a failed generation shows `retryable` and allows the user to retry without losing the current approved snapshot
- error_cases:
  - a failed job clears the current draft and approved baseline
  - job status remains stuck at `running` after the provider already returned failure
- boundary_cases:
  - a retry succeeds after one failure and the audit trail still links both attempts to the same artifact key
  - multiple generation jobs for different artifacts do not cross-report status into the active artifact rail
  - the "Draft all remaining" batch action shows the artifact name and ordinal position within the batch before each generation call, not just a spinner-only state
- references:
  - ui-fields.yaml
  - batch-design.md
  - ui-storybook/stories/SCR-001-example.stories.js
  - test-plan.md
