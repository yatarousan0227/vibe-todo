# /sdd.clarify

Clarify ambiguous or incomplete feature requirements before `sdd.design` starts. This command does not write or rewrite repository files. It inspects the available project standards, shared design context, and optionally an existing brief, then returns the minimum blocking questions and tightening suggestions needed to make the next step safe.

## User Input

```text
$ARGUMENTS
```

You must consider the user input before proceeding. The input may be:

- a feature description or requirement memo that has not been turned into a brief yet
- a `brief-id` such as `001-feature-slug`
- an explicit brief path such as `briefs/001-feature-slug.md`

If the input is empty, stop and ask for either a feature description or the target brief.

## Required Context

Read these files before responding:

- `.specify/project/tech-stack.md`
- `.specify/project/architecture-principles.md`
- `.specify/project/domain-map.md`
- `.specify/glossary.md`
- `.specify/templates/artifacts/brief.md`
- `designs/common_design/`

If the input resolves to an existing brief, also read:

- the selected file under `briefs/`
- every referenced `CD-*` file under `designs/common_design/` when it can be resolved unambiguously

## Workflow

1. Resolve the working mode:
   - use `pre-design` when the input resolves to exactly one brief under `briefs/`
   - use `pre-brief` when the input is only a feature description, draft requirement list, or business memo
   - if multiple briefs match, stop and ask which brief should be clarified
2. Build the clarification context:
   - inspect `.specify/project/domain-map.md` for domain boundaries, upstream and downstream dependencies, and related briefs
   - inspect `designs/common_design/` for reusable shared APIs, data models, modules, and UI conventions
   - use `.specify/glossary.md` and `.specify/project/tech-stack.md` to normalize terminology and implementation constraints
3. Review domain alignment:
   - identify the primary domain the feature belongs to
   - identify related briefs or dependent domains that may affect review scope
   - if the domain boundary is ambiguous, treat it as a blocking question instead of inventing an answer
4. Review shared design references:
   - determine whether the feature depends on existing `CD-*` artifacts
   - identify missing shared design references, over-broad references, or references that should stay feature-specific
   - if a referenced `CD-*` cannot be resolved uniquely, treat it as a blocking question
5. Review actors, scope, constraints, and review prerequisites:
   - identify missing users, operators, external systems, or approval dependencies
   - identify missing boundary conditions, operational constraints, non-functional constraints, or rollout assumptions
6. Review requirement quality:
   - in `pre-design`, read every `REQ-xxx` from the brief
   - in `pre-brief`, derive draft requirements from the user input when possible
   - rewrite ambiguous requirements into testable statements
   - flag requirements that are compound, non-verifiable, or missing measurable behavior
7. Produce only the clarification report:
   - do not create or edit `briefs/*.md`
   - do not update `.specify/project/*.md`
   - do not create or update `designs/common_design/`
   - do not start `sdd.design`

## Output Contract

Return the result in this structure:

```markdown
# Clarify Report: <target>

- mode: pre-brief | pre-design
- readiness: ready | needs-input | blocked
- target: <feature description, brief-id, or brief path>

## Blocking Questions
1. <question that must be answered before design begins>

## Recommended Tightening
- <non-blocking clarification or cleanup suggestion>

## Candidate Requirement Rewrites
- <draft requirement or REQ-xxx> -> <testable wording>

## Proposed Next Step
- <create brief | update brief | create shared design first | proceed to design>
```

Output rules:

- prefer at most 5 blocking questions
- order questions by impact on `sdd.design`
- put non-blocking issues under `## Recommended Tightening` instead of inflating the blocking list
- when there is no rewrite to propose, explicitly write `- none`
- when there are no blocking questions, explicitly write `1. none`

## Clarification Criteria

Always evaluate at least these categories:

- `Domain Alignment`
- `Common Design References`
- `Actors / External Interfaces`
- `Scope / Boundary Conditions`
- `Non-Functional / Operations`
- `Requirement Testability`
- `Review / Approval Preconditions`

Use these readiness levels:

- `ready`: no blocking ambiguity remains for `sdd.design`
- `needs-input`: a small number of answers or brief edits are still needed
- `blocked`: domain, shared design, or requirement ambiguity makes design unsafe to start

## Validation Checklist

Before finishing, verify all of the following:

- the response clearly states `pre-brief` or `pre-design`
- the response clearly states `ready`, `needs-input`, or `blocked`
- `Domain Alignment` is reviewed against `.specify/project/domain-map.md`
- `Common Design References` are checked against `designs/common_design/`
- requirement rewrites push ambiguous statements toward testable wording
- blocking questions and non-blocking tightening suggestions are separated
- the result does not rewrite files or silently choose an invented assumption

## Responsibility Boundary

This command clarifies what must be answered or tightened before design work continues. It does not replace `sdd.brief`, does not regenerate briefs, does not update shared design documents, and does not perform the mechanical consistency checks handled by `sdd.analyze`.
