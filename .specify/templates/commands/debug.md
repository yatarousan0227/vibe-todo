# /sdd.debug

Debug a bug through code fix, verification, and design/task synchronization. This command is for defect-driven work where the repository must end with both the implementation and the affected design artifacts updated consistently.

## User Input

```text
$ARGUMENTS
```

You must consider the user input before proceeding. The input may provide:

- a `design-id`
- one or more `TASK-xxx` identifiers
- a bug summary, failure symptom, or reproduction note
- changed file paths or a request to infer context from the current working tree diff

If the input is empty, inspect the current working tree diff first and stop only if you still cannot identify the bug context.

## Required Context

Read these files before writing anything:

- `designs/specific_design/` to resolve candidate bundles from the input, changed paths, and current diff
- `designs/common_design/` to resolve shared design dependencies that may be impacted
- `.specify/project/tech-stack.md`
- `.specify/project/coding-rules.md`
- `.specify/project/architecture-principles.md`
- `.specify/project/domain-map.md`
- the current working tree diff
- the relevant source code, tests, and runtime configuration for the bug

When one or more specific bundles are resolved, also read for each impacted `design-id`:

- `designs/specific_design/<design-id>/overview.md`
- `designs/specific_design/<design-id>/common-design-refs.yaml`
- `designs/specific_design/<design-id>/traceability.yaml`
- `designs/specific_design/<design-id>/test-design.md`
- `designs/specific_design/<design-id>/test-plan.md`
- `designs/specific_design/<design-id>/tasks.md`
- the referenced files under `designs/common_design/`

Do not update `briefs/*.md` as part of this command.

## Workflow

1. Resolve the debugging scope:
   - prefer explicit `design-id` and `TASK-xxx` input when present
   - otherwise infer impacted bundles from the bug description, changed paths, blame context, or current working tree diff
   - when multiple bundles match, keep all matching bundles in scope
2. Reproduce or verify the bug signal:
   - inspect failing tests, logs, or reproduction steps when they exist
   - if no explicit reproduction exists, derive the smallest reliable verification signal from the current code and diff
3. Identify the implementation gap:
   - map the bug to the affected requirement IDs, task IDs, and shared design references when they exist
   - if the current `tasks.md` does not represent the needed fix cleanly, regenerate or extend task definitions before updating execution ledger details
4. Update the implementation:
   - change only the code needed to fix the bug and its directly affected tests
   - keep unrelated refactors out of scope
5. Run relevant local verification:
   - execute the narrowest commands that prove the fix
   - continue debugging within reasonable scope until verification is passing or the work is clearly blocked
6. Synchronize design artifacts with the final code change:
   - update impacted files under `designs/specific_design/<design-id>/` when behavior, interfaces, test intent, or execution assumptions changed
   - update impacted files under `designs/common_design/` when the bug fix changes shared API, data, module, or UI truth
   - update `designs/specific_design/<design-id>/tasks.md` so task definitions and execution ledger fields reflect the actual work
7. Review the final `git diff`:
   - ensure code changes, tests, and design/task updates tell the same story
   - if the fix implies brief drift, call it out explicitly in the response instead of editing `briefs/*.md`

## Output Contract

The repository state after this command must satisfy all of the following:

- the bug fix is implemented in code or clearly marked blocked
- relevant verification commands were actually run and recorded
- impacted `specific_design` and `common_design` documents are synchronized to the final code behavior
- impacted `tasks.md` files are updated, including task definition regeneration when needed
- `briefs/*.md` remain unchanged

For each impacted `tasks.md`, end the targeted execution sections in one of these states:

- `status: done` when the fix and verification are complete
- `status: blocked` when required dependencies or foundations are missing
- `status: in_progress` only when the user explicitly asked for a partial stop

## Validation

Before finishing, verify all of the following:

- every impacted bundle was identified from explicit input or defensible repo evidence
- code changes and tests are consistent with the updated design artifacts
- `tasks.md` execution logs match the actual changed files and commands run
- shared design documents are updated when the fix changes shared truth
- no `briefs/*.md` file was edited
- the final `git diff` was reviewed

## Responsibility Boundary

This command owns defect-driven code changes plus the required synchronization of design artifacts and task ledgers. It is not a brief-regeneration command.
