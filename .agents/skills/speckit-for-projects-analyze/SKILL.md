---
name: speckit-for-projects-analyze
description: Inspect design bundles and report consistency issues without rewriting artifacts.
metadata:
  command: /sdd.analyze
  source: .specify/templates/commands/analyze.md
---

# /sdd.analyze

Inspect one specific design bundle and report consistency issues without rewriting artifacts. This command validates the generated bundle against the brief, shared project standards, and referenced common design documents, then returns a success or failure report with issue categories and concrete findings.

## User Input

```text
$ARGUMENTS
```

You must consider the user input before proceeding. The input should identify either a `design-id`, a bundle path under `designs/specific_design/`, or request `--all` style analysis across all specific bundles.

## Required Context

Read these files before reporting anything:

- the selected file under `briefs/` when it exists
- `.specify/project/tech-stack.md`
- `.specify/project/coding-rules.md`
- `.specify/project/architecture-principles.md`
- `.specify/project/domain-map.md`
- `.specify/glossary.md`
- `designs/common_design/`
- `designs/specific_design/<design-id>/overview.md`
- `designs/specific_design/<design-id>/ui-fields.yaml`
- `designs/specific_design/<design-id>/common-design-refs.yaml`
- `designs/specific_design/<design-id>/sequence-flows/core-flow.md`
- `designs/specific_design/<design-id>/batch-design.md`
- `designs/specific_design/<design-id>/test-design.md`
- `designs/specific_design/<design-id>/test-plan.md`
- `designs/specific_design/<design-id>/traceability.yaml`
- `designs/specific_design/<design-id>/tasks.md`
- `designs/specific_design/<design-id>/ui-storybook/`

If the user requests all bundles, inspect every directory directly under `designs/specific_design/`.

## Workflow

1. Resolve the target bundle:
   - accept a `design-id` such as `001-feature-slug`
   - accept an explicit bundle path such as `designs/specific_design/001-feature-slug`
   - when the request implies all bundles, inspect every bundle under `designs/specific_design/`
2. Resolve the matching brief under `briefs/<design-id>.md` when it exists.
3. Check required bundle structure:
   - required artifact files exist
   - at least one Storybook story and one component template exist
   - legacy files like `api-design.md`, `data-design.md`, and `module-design.md` are not present
4. Check `traceability.yaml`:
   - the file parses as YAML mapping data
   - every requirement entry has `requirement_id`
   - every requirement entry has a specific-design `primary_artifact`
   - `related_artifacts` is a list
   - `common_design_refs` is present and is a list
   - every traceability common design ref appears in `common-design-refs.yaml`
5. Check `common-design-refs.yaml`:
   - the file parses as YAML mapping data
   - `common_design_refs` is a list
   - every entry has a valid `ref_id`
   - every referenced common design ID resolves to exactly one file under `designs/common_design/`
6. If the brief exists, compare it against the bundle:
   - every `REQ-xxx` in the brief appears in `traceability.yaml`
   - every `REQ-xxx` in the brief appears in `tasks.md`
   - every shared design reference in the brief appears in `common-design-refs.yaml`
7. Check `tasks.md`:
   - the file references at least one specific artifact or common design ref
   - requirement coverage matches the brief when the brief exists
8. Report findings only. Do not rewrite bundle files as part of this command.

## Output Contract

Return the result in this structure:

```text
summary:
- bundle: <designs/specific_design/<design-id>>
- status: success | failure
- total_issues: <count>

issue counts:
- missing_files: <count>
- missing_requirements: <count>
- uncovered_task_requirements: <count>
- invalid_traceability_entries: <count>
- invalid_common_design_entries: <count>
- invalid_structure_entries: <count>

details:
- <category>: <message>
```

When multiple bundles are analyzed, also include:

- total inspected bundle count
- success bundle count
- failure bundle count
- failure bundle list

## Validation Checklist

Before finishing, verify all of the following:

- the bundle target resolved unambiguously
- missing files are reported under `missing_files`
- brief requirements missing from `traceability.yaml` are reported under `missing_requirements`
- brief requirements missing from `tasks.md` are reported under `uncovered_task_requirements`
- malformed or inconsistent `traceability.yaml` findings are reported under `invalid_traceability_entries`
- malformed, missing, or unresolved common design references are reported under `invalid_common_design_entries`
- bundle structure violations are reported under `invalid_structure_entries`
- the response clearly separates success or failure from the issue detail

## Responsibility Boundary

This command reports what is wrong with the design bundle. It does not repair artifacts, regenerate files, or fold the result into `sdd check`.
