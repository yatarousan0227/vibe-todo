# Test Design

## Requirement Coverage

### REQ-001
- normal_cases:
  - the screen accepts synthesis only when every required artifact for the active `project_id` is both approved and current
  - the eligibility panel names every missing or stale `artifact_key` when readiness is incomplete
- error_cases:
  - synthesis starts while one required artifact remains stale from a newer upstream approval
  - the readiness response hides one missing artifact and incorrectly enables the synthesize action
- boundary_cases:
  - a project with all artifacts approved except the final required artifact still keeps synthesis disabled
  - `project` and `daily_work` both reuse the same required artifact set and return the same readiness semantics
- references:
  - overview.md
  - ui-fields.yaml
  - sequence-flows/core-flow.md
  - common-design-refs.yaml

### REQ-002
- normal_cases:
  - a generated candidate task plan is reviewable in `SCR-004` and does not appear in `SCR-005` until publish succeeds
  - pre-publish corrections can change existing task field values and dependencies without adding or deleting tasks
- error_cases:
  - publish auto-runs immediately after synthesis completion with no explicit user decision
  - the correction UI allows a task delete or clears all related artifact links from one task
- boundary_cases:
  - the user edits several tasks in a candidate snapshot and publish still requires one explicit action on that snapshot
  - the same task is corrected twice before publish and the screen still treats it as one immutable snapshot under review
- references:
  - overview.md
  - ui-fields.yaml
  - sequence-flows/core-flow.md
  - ui-storybook/stories/SCR-001-example.stories.js

### REQ-003
- normal_cases:
  - every publishable task has non-null `Title`, `Description`, `Priority`, `Status`, `Due Date`, `Dependencies`, `Estimate`, and `Assignee`
  - when synthesis cannot infer `Due Date`, `Estimate`, or `Assignee`, the candidate snapshot either records placeholder values with review notes or blocks publish with explicit reasons
- error_cases:
  - a task reaches publish with `Due Date` missing and no blocker is reported
  - placeholder-generated values are persisted but hidden from the reviewer
- boundary_cases:
  - one candidate snapshot mixes confidently generated values with provisional placeholders and the UI marks only the provisional fields
  - a correction replaces a placeholder assignee with `self` and publish unblocks without changing traceability
- references:
  - overview.md
  - ui-fields.yaml
  - common-design-refs.yaml
  - test-plan.md

### REQ-004
- normal_cases:
  - the generated task table preserves dependency task IDs and execution-order metadata needed for gantt and blocked-state calculations
  - publishable snapshots return an ordered task collection that stays stable across review reloads
- error_cases:
  - dependency edits allow a self-reference or cross-snapshot task ID that breaks execution order
  - the table row order drifts from the stored execution metadata after a reload
- boundary_cases:
  - a plan with no dependencies still returns an ordered set and explicit empty dependency lists
  - two tasks share the same due date and the order still follows execution metadata rather than arbitrary UI sorting
- references:
  - overview.md
  - ui-fields.yaml
  - sequence-flows/core-flow.md
  - common-design-refs.yaml

### REQ-005
- normal_cases:
  - each task exposes at least one approved `artifact_snapshot_id` in `Related Artifacts`
  - task corrections preserve the same artifact links after save and after publish
- error_cases:
  - a patch request clears all `TaskArtifactLink` rows for one task and the system accepts it
  - the UI shows display labels for related artifacts but cannot resolve the underlying snapshot IDs
- boundary_cases:
  - one task traces to multiple artifacts and the panel still renders a stable list of links
  - a task with one required link remains publishable after canonical field corrections
- references:
  - ui-fields.yaml
  - sequence-flows/core-flow.md
  - common-design-refs.yaml
  - traceability.yaml

### REQ-006
- normal_cases:
  - when any source artifact in the current published plan is replaced by a newer approved snapshot, the published plan becomes `stale` and read-only
  - regeneration creates a fresh candidate snapshot while the stale published plan remains available for reference
- error_cases:
  - a stale published plan remains editable in the task synthesis screen
  - the stale banner does not identify the changed upstream artifact or required follow-up action
- boundary_cases:
  - a project with no published plan yet still shows stale candidate readiness without referencing a nonexistent current plan
  - multiple upstream artifact replacements collapse into one stale summary that still names every affected source snapshot
- references:
  - overview.md
  - ui-fields.yaml
  - sequence-flows/core-flow.md
  - test-plan.md

### REQ-007
- normal_cases:
  - each synthesis attempt writes a new immutable `TaskPlanSnapshot` with `generated_at`, source artifact snapshot IDs, and generated task IDs
  - the system can compare two snapshots and report which tasks were added, removed, or materially changed
- error_cases:
  - regeneration overwrites the previously generated snapshot in place
  - snapshot history omits the source artifact set needed for later diff analysis
- boundary_cases:
  - two synthesis attempts run close together and still produce distinct snapshot IDs with stable lineage
  - a candidate snapshot is never published yet remains queryable for audit and diff review
- references:
  - sequence-flows/core-flow.md
  - batch-design.md
  - common-design-refs.yaml
  - traceability.yaml

### REQ-008
- normal_cases:
  - PostgreSQL persistence is accessed only through `TaskPlanRepository` behavior visible to the module, not via screen-owned queries
  - switching the planning engine implementation does not change the task synthesis command or review contract
- error_cases:
  - the module directly imports PostgreSQL-specific schema types into domain logic
  - provider-specific request fields become mandatory in the screen or API payload
- boundary_cases:
  - one environment uses deterministic fixture planning while another uses an AI-backed engine and both satisfy the same module contract
  - a persistence adapter failure returns a normalized application error without exposing SQL details in the UI
- references:
  - common-design-refs.yaml
  - sequence-flows/core-flow.md
  - batch-design.md
  - traceability.yaml

### REQ-009
- normal_cases:
  - a long-running synthesis job progresses through `queued`, `running`, and `completed` while the current published plan remains available
  - a failed synthesis reports `retryable` and allows a new attempt without erasing the last published task plan
- error_cases:
  - a failed job clears the previously published task plan from workspace context
  - job status remains stuck at `running` after the planning engine has already returned failure
- boundary_cases:
  - a retry succeeds after one failure and the audit trail still identifies both attempts against the same planning basis
  - two synthesis jobs for different projects report status independently and do not leak across `project_id`
- references:
  - ui-fields.yaml
  - batch-design.md
  - ui-storybook/stories/SCR-001-example.stories.js
  - test-plan.md
