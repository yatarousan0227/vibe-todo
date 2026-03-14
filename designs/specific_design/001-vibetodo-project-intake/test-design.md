# Test Design

## Requirement Coverage

### REQ-001
- normal_cases:
  - `project` mode captures structured fields and free-form context in the same draft save request and the resumed draft restores both.
  - `daily_work` mode captures its mode-specific field set plus the same free-form context area.
- error_cases:
  - save request omits free-form context and the UI surfaces a validation error without discarding structured input.
  - API accepts only one side of the mixed input and the integration test fails because the persisted draft is incomplete.
- boundary_cases:
  - free-form context spans multiple paragraphs and line breaks remain intact after resume.
  - user switches planning mode mid-draft and only the correct mode-specific required fields remain enforced.
- references:
  - overview.md
  - ui-fields.yaml
  - sequence-flows/core-flow.md
  - common-design-refs.yaml

### REQ-002
- normal_cases:
  - `project` mode requires `title`, `objective`, `background_or_current_situation`, `scope_summary`, `constraints_or_conditions`, and `stakeholders`.
  - `daily_work` mode requires `title`, `objective`, `background_or_current_situation`, `expected_outcome_or_deliverable`, and `constraints_or_conditions`.
- error_cases:
  - project-only fields are incorrectly required in `daily_work` mode.
  - software-specific labels are presented as mandatory terminology in either mode.
- boundary_cases:
  - stakeholders field accepts non-software roles such as clients, approvers, or family members.
  - constraints accept policy or schedule language rather than engineering-only constraints.
- references:
  - overview.md
  - ui-fields.yaml
  - common-design-refs.yaml

### REQ-003
- normal_cases:
  - first save creates a `Project` with `lifecycle_status=draft_intake`.
  - later saves with the same `project_id` update the same draft rather than creating a second project.
- error_cases:
  - resume with an unknown `project_id` returns a recoverable not-found state.
  - save conflict on PostgreSQL returns a normalized persistence error instead of silently overwriting the latest draft.
- boundary_cases:
  - multiple local drafts exist with no authentication and each can be resumed independently.
  - resumed draft includes the latest planning mode and all mode-specific fields after switching modes earlier.
- references:
  - overview.md
  - sequence-flows/core-flow.md
  - common-design-refs.yaml

### REQ-004
- normal_cases:
  - confirm action writes `project_id`, `title`, `planning_mode`, confirmed structured input, confirmed free-form input, and `confirmed_at` into current project context.
  - confirmation creates one active `RefinementSession` with `active_artifact_key=objective_and_outcome`.
- error_cases:
  - partial write persists the intake snapshot but fails to create the session; the operation must roll back or surface a blocking error.
  - second confirmation attempt tries to create another active session for the same project and is rejected.
- boundary_cases:
  - confirm immediately after a fresh save without reopening the review state still uses the latest edited values.
  - empty optional fields for the inactive mode do not block session initialization.
- references:
  - overview.md
  - sequence-flows/core-flow.md
  - common-design-refs.yaml

### REQ-005
- normal_cases:
  - review state shows all structured and free-form values before start and allows returning to edit without losing content.
  - user edits both structured and free-form inputs from the review state and then confirms successfully.
- error_cases:
  - review state truncates free-form context and hides material details needed for confirmation.
  - confirm button becomes available before required mode-specific fields are present.
- boundary_cases:
  - long stakeholder or deliverable lists remain readable in review.
  - rapid edit-review-edit transitions preserve unsaved changes within the same local UI session.
- references:
  - overview.md
  - ui-fields.yaml
  - ui-storybook/stories/SCR-001-example.stories.js

### REQ-006
- normal_cases:
  - local Docker compose starts the Next.js app and PostgreSQL, and the intake screen loads without authentication.
  - save, resume, and confirm flows work against PostgreSQL inside the local environment.
- error_cases:
  - PostgreSQL is unavailable and the UI surfaces a system error instead of pretending the draft was saved.
  - local environment requires an auth gate and blocks access to the intake screen.
- boundary_cases:
  - database starts later than the web process and the user can retry save without restarting the app.
  - multiple drafts are created in one local environment session without authentication side effects.
- references:
  - overview.md
  - sequence-flows/core-flow.md
  - test-plan.md
