# /sdd.reflect

Inspect the current working tree diff and repair missing or incomplete design/task updates caused by manual code changes. This command treats the current diff as the source of truth and reconciles documentation drift without rewriting briefs.

## User Input

```text
$ARGUMENTS
```

You must consider the user input before proceeding. The input may provide:

- a `design-id`
- changed file paths
- a short explanation of the manual change
- an instruction to inspect the current working tree diff

If the input is empty, use the current working tree diff.

## Required Context

Read these files before writing anything:

- the current working tree diff
- `.specify/project/tech-stack.md`
- `.specify/project/coding-rules.md`
- `.specify/project/architecture-principles.md`
- `.specify/project/domain-map.md`
- `designs/specific_design/` to resolve impacted bundles
- `designs/common_design/` to resolve impacted shared design documents
- the affected source code and tests referenced by the diff

For each impacted `design-id`, also read:

- `designs/specific_design/<design-id>/overview.md`
- `designs/specific_design/<design-id>/common-design-refs.yaml`
- `designs/specific_design/<design-id>/traceability.yaml`
- `designs/specific_design/<design-id>/test-design.md`
- `designs/specific_design/<design-id>/test-plan.md`
- `designs/specific_design/<design-id>/tasks.md`
- the referenced files under `designs/common_design/`

Do not edit `briefs/*.md` as part of this command.

## Workflow

1. Resolve the reflection scope:
   - treat the current working tree diff as the primary truth source
   - use explicit `design-id` or file path hints when the user provides them
   - when multiple bundles match the changed code, keep all matching bundles in scope
2. Identify documentation drift:
   - compare the changed code and tests against the current specific-design artifacts
   - compare the changed code and tests against referenced `designs/common_design/` documents
   - compare the changed code and tests against `tasks.md` requirement coverage, task definitions, and execution ledger state
3. Repair `tasks.md` drift:
   - if the manual change fits existing tasks, update only the needed task definitions and execution ledger fields
   - if the change is not represented well, regenerate or extend task definitions before updating execution evidence
4. Repair specific design drift:
   - update only the impacted files under `designs/specific_design/<design-id>/`
   - keep unchanged artifacts untouched
5. Repair shared design drift:
   - update impacted files under `designs/common_design/` only when the manual change altered shared truth
6. Review the final `git diff`:
   - ensure the repository now reflects the manual code change consistently across code, specific design, shared design, and tasks
   - if the change implies brief drift, note it explicitly instead of editing `briefs/*.md`

## Output Contract

After this command completes:

- current code and tests remain the truth source
- impacted `specific_design` and `common_design` documents are synchronized to that truth
- impacted `tasks.md` files are updated, including regenerated task definitions when required
- `briefs/*.md` remain unchanged

## Validation

Before finishing, verify all of the following:

- the working tree diff was inspected directly
- every impacted bundle was resolved from changed-code evidence
- `tasks.md` reflects the implemented change completely enough for future work and audit history
- shared design documents were updated only when shared truth changed
- no `briefs/*.md` file was edited
- the final `git diff` was reviewed

## Responsibility Boundary

This command reconciles design and task documents to manual code changes already present in the working tree. It does not replace `sdd.debug`, and it does not rewrite briefs.
