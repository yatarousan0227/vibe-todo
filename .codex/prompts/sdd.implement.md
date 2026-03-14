# sdd.implement

Agent: Codex CLI

Implement selected TASK-xxx items and update execution state in tasks.md.

Note: Codex CLI treats this file as a saved prompt. It does not auto-register `/sdd.implement` as a slash command. Open this file and use its contents directly, or install skills with `sdd init --ai codex --ai-skills` and ask Codex to use `speckit-for-projects-implement`.

---

# /sdd.implement

Implement selected `TASK-xxx` items from `designs/specific_design/<design-id>/tasks.md`. This command must update production code, add or adjust tests as needed, run relevant local verification, and then write execution results back into the matching task sections.

## User Input

```text
$ARGUMENTS
```

You must consider the user input before proceeding. The input should identify:

- a `design-id` or a design bundle path
- one or more explicit task IDs such as `TASK-001`
- whether this is a rerun when the targeted task already shows `status: done`

If no explicit task IDs are provided, stop and ask the user to select one or more `TASK-xxx` entries instead of implementing the whole bundle.

## Required Context

Read these files before writing anything:

- `designs/specific_design/<design-id>/tasks.md`
- `designs/specific_design/<design-id>/traceability.yaml`
- `designs/specific_design/<design-id>/common-design-refs.yaml`
- `designs/specific_design/<design-id>/test-design.md`
- `designs/specific_design/<design-id>/test-plan.md`
- the referenced files under `designs/common_design/`
- `.specify/project/tech-stack.md`
- `.specify/project/coding-rules.md`
- `.specify/project/architecture-principles.md`
- `.specify/project/domain-map.md`
- the existing source code, tests, and build configuration in the repository that correspond to the targeted task IDs

If required design artifacts are missing, stop and report the missing files. If the repository lacks the runtime foundation needed to implement a selected task, stop and report the missing modules, entrypoints, or build/test prerequisites instead of inventing a large new application skeleton.

## Workflow

1. Resolve the target `design-id` and targeted `TASK-xxx` entries from the user input.
2. Read only the selected task sections and extract:
   - requirement IDs
   - artifact references
   - common design references
   - dependencies
   - related brief or domain dependency assumptions when present
   - current execution state and checklist items
3. If any selected task already has `status: done`, stop unless the user explicitly requested a rerun.
4. Inspect the repository to find the concrete implementation files, tests, and verification commands needed for the selected tasks.
5. Update only the code required for the selected tasks. Do not implement unrelated tasks from the same bundle.
6. Add or update tests when the task changes behavior that should be covered.
7. Run the relevant local verification commands. If verification fails, continue debugging and fixing within a reasonable scope. If the targeted changes still cannot pass verification, stop and mark the task as failed or blocked with the reason.
8. Update only the mutable execution sections for each targeted task in `designs/specific_design/<design-id>/tasks.md`:
   - `#### Execution Status`
   - `#### Checklist`
   - `#### Implementation Log`
   - `#### Changed Files`
   - `#### Verification Results`
9. Review the final `git diff` and ensure the changed files and verification notes in `tasks.md` match the actual result.

## Output Contract

For every targeted task, the mutable execution section in `tasks.md` must end in one of these terminal states:

- `status: done` when code changes were made and relevant verification passed
- `status: blocked` when implementation could not proceed because required runtime foundations or dependencies were missing
- `status: in_progress` only when the user explicitly asked for a partial implementation stop

Update the checklist using these semantics:

- mark `implement code` when the required code changes are complete
- mark `add or update tests` when test coverage was added or confirmed unnecessary with a note
- mark `run local verification` only when commands were actually executed
- mark `review diff` only after checking the final diff

Record concrete evidence:

- `Implementation Log`: timestamped bullets describing what changed or why progress stopped
- `Changed Files`: repo-relative file paths actually modified
- `Verification Results`: final status, commands executed, and a short result summary

## Validation

Before finishing, verify all of the following:

- only the selected `TASK-xxx` items were implemented
- code changes are consistent with the referenced design artifacts, shared design refs, and project rules
- shared UI refs such as `CD-UI-*` are treated the same as API/Data/Module common refs when the selected task depends on them
- any cross-domain assumptions recorded in the task or design bundle were respected or explicitly called out in the implementation log
- `tasks.md` task definitions above `#### Execution Status` were not rewritten
- `Changed Files` in `tasks.md` matches the real diff
- `Verification Results` reflects commands that were actually run
- `git diff` has been reviewed

## Regeneration Policy

This command must not rewrite task definitions or unrelated task execution history. It only mutates the execution ledger fields for the selected tasks.
