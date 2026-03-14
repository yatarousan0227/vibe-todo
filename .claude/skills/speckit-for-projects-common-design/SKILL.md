---
name: speckit-for-projects-common-design
description: Create or update one shared design artifact under designs/common_design/.
metadata:
  command: /sdd.common-design
  source: .specify/templates/commands/common-design.md
---

# /sdd.common-design

Create or update one shared design artifact under `designs/common_design/`. This command manages the canonical shared design for APIs, data models, module boundaries, or UI conventions that multiple specific designs will reference.

## User Input

```text
$ARGUMENTS
```

You must consider the user input before proceeding. The input should identify:

- the shared design kind: `api`, `data`, `module`, or `ui`
- either an existing shared design ID such as `CD-API-001` or enough context to derive one
- for `ui`, identify whether the artifact is a shared screen catalog or shared navigation rules document
- the business capability or cross-feature concern the shared design should own

## Required Context

Read these files before writing anything:

- `.specify/project/tech-stack.md`
- `.specify/project/coding-rules.md`
- `.specify/project/architecture-principles.md`
- `.specify/project/domain-map.md`
- `.specify/glossary.md`
- `.specify/templates/artifacts/common_design/`
- `briefs/` when the user input points to one or more briefs that justify the shared design
- `designs/common_design/` to inspect existing IDs and avoid collisions

## Workflow

1. Resolve the target kind and shared design scope from the user input.
2. Determine the shared design ID:
   - use `CD-API-001`, `CD-DATA-001`, `CD-MOD-001`, or `CD-UI-001` prefixes based on the selected kind
   - reuse an existing ID only when the user explicitly requests regeneration of the same shared design
   - otherwise allocate the next available 3-digit sequence inside the selected kind directory
3. Confirm the design belongs in `common_design`:
   - keep only design that is reused across multiple specific designs or briefs
   - reject utility helpers or implementation-only convenience classes
4. Write exactly one file:
   - `designs/common_design/api/<id>-<slug>.md`
   - `designs/common_design/data/<id>-<slug>.md`
   - `designs/common_design/module/<id>-<slug>.md`
   - `designs/common_design/ui/<id>-screen-catalog.md`
   - `designs/common_design/ui/<id>-navigation-rules.md`
5. Use the matching template under `.specify/templates/artifacts/common_design/` as the canonical scaffold.
6. Overwrite the entire file when regenerating. Do not merge managed sections.

## Output Contract

- shared API design: canonical interface contract, consumers, invariants, and versioning notes
- shared data design: canonical entity model, shared fields, and relationship rules
- shared module design: canonical responsibility boundary, public interface, and collaboration rules
- shared UI design: canonical screen catalog or canonical navigation rules reused by multiple features

The shared design must:

- start with the shared design ID in the document body
- explain why the design is shared instead of specific to one feature
- list downstream specific designs or briefs when they are known
- avoid feature-specific UI state, sequence detail, test plan, or task details

## Validation

Before finishing, verify all of the following:

- the output file lives under `designs/common_design/<kind>/`
- the file name starts with the resolved `CD-*` identifier
- the content describes shared design truth, not feature-specific application logic
- any cited briefs or domains are consistent with `.specify/project/domain-map.md`
- regeneration is full-file overwrite

## Regeneration Policy

This command uses full-file overwrite semantics for the selected shared design artifact. After writing the file, review the result with `git diff`.
