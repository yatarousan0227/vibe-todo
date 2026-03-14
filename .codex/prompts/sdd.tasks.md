# sdd.tasks

Agent: Codex CLI

Create or update tasks.md as a regenerable implementation ledger.

Note: Codex CLI treats this file as a saved prompt. It does not auto-register `/sdd.tasks` as a slash command. Open this file and use its contents directly, or install skills with `sdd init --ai codex --ai-skills` and ask Codex to use `speckit-for-projects-tasks`.

---

# /sdd.tasks

Create or update `designs/specific_design/<design-id>/tasks.md` from the selected design bundle. This command must produce an actionable task list tied back to requirements, specific artifacts, and shared design references while preserving existing execution ledger fields for matching task IDs.

## User Input

```text
$ARGUMENTS
```

You must consider the user input before proceeding. The input should identify a `design-id` or a design bundle path.

## Required Context

Read these files before writing anything:

- `designs/specific_design/<design-id>/overview.md`
- `designs/specific_design/<design-id>/ui-storybook/`
- `designs/specific_design/<design-id>/ui-fields.yaml`
- `designs/specific_design/<design-id>/common-design-refs.yaml`
- `designs/specific_design/<design-id>/sequence-flows/`
- `designs/specific_design/<design-id>/batch-design.md`
- `designs/specific_design/<design-id>/test-design.md`
- `designs/specific_design/<design-id>/test-plan.md`
- `designs/specific_design/<design-id>/traceability.yaml`
- `designs/common_design/`
- `.specify/project/domain-map.md`
- `.specify/project/coding-rules.md`
- `.specify/templates/artifacts/design/tasks.md`

If any required artifact is missing, stop and report the missing files instead of generating tasks.

## Workflow

1. Resolve the target `design-id` from the user input.
2. Load `traceability.yaml` and confirm all requirements are mapped.
3. Read any domain alignment or related brief references from the design bundle and `.specify/project/domain-map.md`.
4. Break the work into dependency-ordered tasks using the design bundle as the source of truth.
5. Every task must include:
   - a task ID `TASK-001`, `TASK-002`, ...
   - the linked requirement IDs
   - the specific design artifacts that justify the task
   - the shared design references that justify the task when applicable
   - dependencies when execution order matters
6. Use `## Execution Assumptions` to record cross-domain review dependencies or related brief prerequisites when they affect implementation order.
7. Write the generated task definition fields for the entire `designs/specific_design/<design-id>/tasks.md` file in one pass.
8. If `tasks.md` already exists:
   - match tasks by `TASK-xxx`
   - preserve the mutable execution ledger sections from `#### Execution Status` onward for matching tasks
   - move removed tasks into `## Archived Execution History` with their existing execution details intact
   - do not preserve stale requirement IDs, artifact references, shared design refs, or dependency definitions above `#### Execution Status`

## Output Contract

Use `.specify/templates/artifacts/design/tasks.md` as the section scaffold, then write `designs/specific_design/<design-id>/tasks.md` using this exact section order:

```markdown
# Tasks For <design-id>

- brief_id: <brief-id>
- design_id: <design-id>

## Execution Assumptions
- ...

## Tasks
### TASK-001 <task title>
- requirement_ids:
  - REQ-001
- artifact_refs:
  - overview.md
  - common-design-refs.yaml
- common_design_refs:
  - CD-API-001
  - CD-UI-001
- depends_on:
  - none
- implementation_notes:
  - <what to build or verify>

#### Execution Status
- status: pending
- owner:
- last_updated:

#### Checklist
- [ ] implement code
- [ ] add or update tests
- [ ] run local verification
- [ ] review diff

#### Implementation Log
- <timestamped note>

#### Changed Files
- <repo-relative path>

#### Verification Results
- status: not_run
- commands:
  - <verification command>
- notes:
  - <result summary>
```

## Validation

Before finishing, verify all of the following:

- every task includes requirement IDs and artifact references
- tasks that rely on shared design include explicit `common_design_refs`, including `CD-UI-*` when the feature depends on shared screens or navigation
- every requirement in `traceability.yaml` is covered by at least one task
- dependencies are explicit when a later task relies on an earlier one
- `## Execution Assumptions` includes related brief or domain dependency notes when cross-domain review affects implementation
- every generated task includes the mutable execution ledger scaffold in the fixed order
- when an existing `tasks.md` is present, matching task execution ledger fields are preserved
- the output path is `designs/specific_design/<design-id>/tasks.md`
- regeneration rewrites generated task definitions while preserving execution ledger fields

## Regeneration Policy

This command regenerates task definitions but preserves execution ledger fields for matching `TASK-xxx` entries. After writing `tasks.md`, review the result with `git diff`.
