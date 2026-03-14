# Test Design

## Requirement Coverage

### REQ-001
- normal_cases:
  - kanban shows every task from the current published plan in exactly one of `backlog`, `ready`, `in_progress`, `blocked`, or `done`
  - changing status from the board updates the same task record visible in task detail and gantt state
- error_cases:
  - the board allows a status outside the fixed enum
  - two views show conflicting status for the same `task_id` after one update
- boundary_cases:
  - an empty status column still renders correctly with zero tasks
  - a plan with all tasks in `blocked` remains editable only while freshness is current
- references:
  - overview.md
  - ui-fields.yaml
  - sequence-flows/core-flow.md
  - common-design-refs.yaml

### REQ-002
- normal_cases:
  - gantt renders `Due Date`, `Estimate`, `Dependencies`, and execution-order metadata from the current published plan
  - blocked tasks and dependency conflicts are visually distinguishable without making the gantt directly editable
- error_cases:
  - gantt attempts to recompute its own dependency order instead of using task-planning metadata
  - timeline drag or resize controls appear in the MVP workspace
- boundary_cases:
  - a task with multiple dependencies still shows one coherent gantt row
  - overdue and blocked tasks remain distinguishable when they overlap in the same period
- references:
  - overview.md
  - ui-fields.yaml
  - sequence-flows/core-flow.md
  - ui-storybook/stories/SCR-001-example.stories.js

### REQ-003
- normal_cases:
  - task detail, kanban, gantt, and artifact health all read the same current published `TaskPlanSnapshot`
  - when the plan becomes stale, the workspace switches to read-only while still showing the stale reason and affected follow-up
- error_cases:
  - one view remains editable after the shared freshness state becomes stale
  - artifact health shows a stale warning that does not match the task plan's actual freshness status
- boundary_cases:
  - the workspace loads directly into read-only after an upstream artifact change with no prior open session
  - a freshly regenerated and published plan returns editing controls without requiring a second local reset
- references:
  - overview.md
  - ui-fields.yaml
  - sequence-flows/core-flow.md
  - test-plan.md

### REQ-004
- normal_cases:
  - task detail allows editing `Description`, `Priority`, `Status`, `Due Date`, `Dependencies`, `Estimate`, and `Assignee` while preserving required fields
  - saving task detail keeps at least one related artifact link visible after refresh
- error_cases:
  - save allows a null required field into the canonical task shape
  - dependencies are saved against a task outside the current plan
- boundary_cases:
  - `Assignee=self` survives the first update and can be changed to another non-empty string
  - a task with one related artifact link remains valid after editing multiple other fields
- references:
  - ui-fields.yaml
  - sequence-flows/core-flow.md
  - common-design-refs.yaml
  - traceability.yaml

### REQ-005
- normal_cases:
  - task detail and artifact health both let the user route back to refinement with `project_id`, `task_id`, `artifact_snapshot_id`, and feedback note
  - returning to `SCR-002` does not create a workspace-side durable feedback record
- error_cases:
  - the workspace launches refinement without a related artifact reference
  - feedback note is dropped between `SCR-005` and `SCR-002`
- boundary_cases:
  - a task with multiple related artifacts lets the user choose one explicit refinement target
  - feedback can be opened from a stale read-only workspace because it is a handoff, not a mutation
- references:
  - overview.md
  - ui-fields.yaml
  - sequence-flows/core-flow.md
  - ui-storybook/stories/SCR-001-example.stories.js

### REQ-006
- normal_cases:
  - the workspace shell supports kanban and gantt as tabs without changing the shared task schema or API contract
  - future view placeholders can be added without rewriting the existing board, gantt, or feedback handoff structure
- error_cases:
  - a new management view requires a separate task schema or local persistence model
  - the workspace shell hard-codes one view in a way that blocks extension
- boundary_cases:
  - a third future tab can be introduced while leaving the current board and gantt behavior unchanged
  - extension affordances remain hidden until enabled without altering the current layout grid
- references:
  - overview.md
  - common-design-refs.yaml
  - ui-storybook/components/SCR-001-example.html
  - test-plan.md

### REQ-007
- normal_cases:
  - local Docker startup exposes the workspace without authentication when a published task plan exists
  - when no current published plan exists, the workspace shows an empty state that routes back to `SCR-004`
- error_cases:
  - the workspace shows unpublished or stale draft data as if it were the current editable plan
  - PostgreSQL outage causes the page to imply success instead of surfacing a system failure
- boundary_cases:
  - the web process starts before PostgreSQL and the user can retry workspace load once the DB is available
  - the same local user can move from `SCR-004` publish to `SCR-005` without any auth transition
- references:
  - overview.md
  - sequence-flows/core-flow.md
  - test-plan.md
  - ui-storybook/stories/SCR-001-example.stories.js
