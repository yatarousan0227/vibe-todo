---
name: speckit-for-projects-brief
description: Create a brief under briefs/<brief-id>.md using 001-kebab-slug naming.
metadata:
  command: /sdd.brief
  source: .specify/templates/commands/brief.md
---

# /sdd.brief

Create `briefs/<brief-id>.md` as the source brief for one project or feature. This command must leave the repository with exactly one newly generated or fully regenerated brief file and no partial edits.

## User Input

```text
$ARGUMENTS
```

You must consider the user input before proceeding. If it is empty, stop and ask for the project or feature description.

## Required Context

Read these files before writing anything:

- `.specify/project/tech-stack.md`
- `.specify/project/architecture-principles.md`
- `.specify/project/domain-map.md`
- `designs/common_design/` to discover reusable shared APIs, data models, modules, and UI conventions when they already exist
- `.specify/glossary.md`
- `.specify/templates/artifacts/brief.md`
- `briefs/` to inspect existing `001-kebab-slug.md` files and determine the next available number

## Workflow

1. Parse the user input and extract:
   - feature or project title
   - background and business goal
   - scope in
   - scope out
   - users, operators, or external systems
   - constraints
   - the initial requirement list
2. Resolve domain alignment from `.specify/project/domain-map.md`:
   - resolve the primary domain the feature belongs to
   - identify related briefs or dependent domains that should be reviewed together
   - if the domain alignment is ambiguous, stop and explain the ambiguity instead of inventing it
3. Resolve shared design references:
   - inspect `designs/common_design/` for existing shared APIs, data models, modules, or UI conventions that this brief will depend on
   - add only explicit shared design IDs such as `CD-API-001` or `CD-UI-001`
   - use `none` when the brief does not depend on any shared design yet
4. Generate `brief-id` using the repo-local `001-kebab-slug` rule:
   - slug = ASCII kebab-case derived from the title
   - number = next available 3-digit sequence across existing files in `briefs/`
   - target path = `briefs/<brief-id>.md`
5. Convert the requirement list into stable IDs:
   - use `REQ-001`, `REQ-002`, ... in the brief
   - keep IDs sequential within the brief
   - ensure each requirement is testable and unambiguous
6. Write the entire brief file in one pass. Do not append partial sections or leave placeholders like `TBD`.
7. If the target file already exists, overwrite the full file content rather than merging sections.

## Output Contract

Use `.specify/templates/artifacts/brief.md` as the section scaffold, then fill it with concrete project content. Write `briefs/<brief-id>.md` using this exact section order:

```markdown
# <Feature Or Project Title>

- brief_id: <brief-id>
- status: draft

## Background
<why this initiative exists>

## Goal
<expected business or operational outcome>

## Scope In
- ...

## Scope Out
- ...

## Users And External Actors
- ...

## Constraints
- ...

## Domain Alignment
- primary_domain: <domain id or `none`>
- related_briefs:
  - <brief-id or `none`>
- upstream_domains:
  - <domain id or `none`>
- downstream_domains:
  - <domain id or `none`>

## Common Design References
- <CD-API-001, CD-UI-001, or `none`>

## Requirements
### REQ-001 <short summary>
- priority: must | should | could
- description: <testable requirement text>
- rationale: <why this matters>

### REQ-002 <short summary>
...

## Source References
- `.specify/project/tech-stack.md`
- `.specify/project/architecture-principles.md`
- `.specify/project/domain-map.md`
- `.specify/glossary.md`
```

## Validation

Before finishing, verify all of the following:

- `brief-id` follows `001-kebab-slug`
- every requirement has a unique `REQ-xxx` ID
- scope in and scope out are both present
- constraints are explicit, not implied
- `## Domain Alignment` is present and uses explicit `none` values when there are no related briefs or domain dependencies
- `## Common Design References` is present and uses explicit `none` when there are no shared design dependencies
- the output path is under `briefs/`
- regeneration is full-file overwrite

## Regeneration Policy

This command uses full-file overwrite semantics. After writing the brief, review the result with `git diff`.
